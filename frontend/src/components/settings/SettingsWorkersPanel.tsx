import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Select, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createWorker,
  deleteWorker,
  fetchWorkersRegistry,
  prepareWorkerRuntime,
  resetWorkerBindCode,
  updateWorker,
  type WorkerBindInfo,
  type WorkerRecord,
  type WorkerVersionRequirement
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { useLocale, useT, type TFunction } from '../../i18n';
import { formatWorkerOptionLabel, getWorkerRuntimeStatusLabel } from '../../utils/workers';
import { WorkerSummaryTag } from '../workers/WorkerSummaryTag';
import { SETTINGS_DATA_TABLE_SCROLL_X, SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME } from './layout';

const DEFAULT_PROVIDER_OPTIONS = [
  { value: 'codex', label: 'Codex' },
  { value: 'claude_code', label: 'Claude Code' },
  { value: 'gemini_cli', label: 'Gemini CLI' }
];

const powerShellQuote = (value: string): string => `'${String(value).replace(/'/g, "''")}'`;

const formatDateTime = (locale: string, value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const describeRuntimeProviders = (providers?: string[] | null): string => {
  if (!Array.isArray(providers) || providers.length === 0) return '-';
  return providers.join(', ');
};

const resolveRuntimeStatus = (worker: WorkerRecord): 'idle' | 'preparing' | 'ready' | 'error' => {
  if (worker.runtimeState?.lastPrepareError) return 'error';
  if ((worker.runtimeState?.preparingProviders?.length ?? 0) > 0) return 'preparing';
  if ((worker.runtimeState?.preparedProviders?.length ?? 0) > 0) return 'ready';
  return 'idle';
};

const resolveRuntimeProviders = (worker: WorkerRecord): string[] => {
  if ((worker.runtimeState?.preparingProviders?.length ?? 0) > 0) return worker.runtimeState?.preparingProviders ?? [];
  return worker.runtimeState?.preparedProviders ?? [];
};

const requiresWorkerUpgrade = (worker: WorkerRecord): boolean => Boolean(worker.versionState?.upgradeRequired);

const describeWorkerVersionState = (
  t: TFunction,
  worker: WorkerRecord,
  versionRequirement?: WorkerVersionRequirement | null
): string | null => {
  const requiredVersion = versionRequirement?.requiredVersion;
  if (!requiredVersion) return null;
  if (worker.versionState?.status === 'mismatch') {
    return t('workers.version.mismatch', {
      current: worker.versionState.currentVersion || '-',
      required: requiredVersion
    });
  }
  if (worker.versionState?.status === 'unknown') {
    return t('workers.version.unknown', { required: requiredVersion });
  }
  return null;
};

const buildInstallScripts = (info: WorkerBindInfo) => {
  const worker = info.worker;
  const requiredVersion = info.versionRequirement.requiredVersion;
  const unixWorkDir = `"$HOME/.hookcode/workers/${worker.id}"`;
  const windowsWorkDir = `"$env:USERPROFILE\\.hookcode\\workers\\${worker.id}"`;
  const workerName = worker.name || 'HookCode Worker';
  const concurrency = String(worker.maxConcurrency || 1);
  const installCommand = `npm install -g @hookvibe/hookcode-worker@${requiredVersion}`;

  return {
    macos: [
      `mkdir -p ${unixWorkDir}`,
      installCommand,
      `HOOKCODE_WORK_DIR=${unixWorkDir} HOOKCODE_WORKER_BIND_CODE='${info.bindCode}' hookcode-worker configure`,
      `HOOKCODE_WORK_DIR=${unixWorkDir} HOOKCODE_WORKER_KIND=remote HOOKCODE_WORKER_NAME='${workerName.replace(/'/g, `'\\''`)}' HOOKCODE_WORKER_MAX_CONCURRENCY='${concurrency}' hookcode-worker run`
    ].join('\n'),
    linux: [
      `mkdir -p ${unixWorkDir}`,
      installCommand,
      `HOOKCODE_WORK_DIR=${unixWorkDir} HOOKCODE_WORKER_BIND_CODE='${info.bindCode}' hookcode-worker configure`,
      `HOOKCODE_WORK_DIR=${unixWorkDir} HOOKCODE_WORKER_KIND=remote HOOKCODE_WORKER_NAME='${workerName.replace(/'/g, `'\\''`)}' HOOKCODE_WORKER_MAX_CONCURRENCY='${concurrency}' hookcode-worker run`
    ].join('\n'),
    windows: [
      `$workDir = ${windowsWorkDir}`,
      'New-Item -ItemType Directory -Force $workDir | Out-Null',
      installCommand,
      '$env:HOOKCODE_WORK_DIR = $workDir',
      `$env:HOOKCODE_WORKER_BIND_CODE = ${powerShellQuote(info.bindCode)}`,
      'hookcode-worker configure',
      'Remove-Item Env:HOOKCODE_WORKER_BIND_CODE -ErrorAction SilentlyContinue',
      `$env:HOOKCODE_WORKER_KIND = 'remote'`,
      `$env:HOOKCODE_WORKER_NAME = ${powerShellQuote(workerName)}`,
      `$env:HOOKCODE_WORKER_MAX_CONCURRENCY = ${powerShellQuote(concurrency)}`,
      'hookcode-worker run'
    ].join('\n')
  };
};

export const SettingsWorkersPanel: FC = () => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [versionRequirement, setVersionRequirement] = useState<WorkerVersionRequirement | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prepareLoadingId, setPrepareLoadingId] = useState<string | null>(null);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [installInfo, setInstallInfo] = useState<WorkerBindInfo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState<WorkerRecord | null>(null);
  const [createForm] = Form.useForm<{ name: string; maxConcurrency?: number }>();
  const [prepareForm] = Form.useForm<{ providers: string[] }>();

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWorkersRegistry();
      setWorkers(data.workers);
      setVersionRequirement(data.versionRequirement);
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.fetchFailed'));
      setWorkers([]);
      setVersionRequirement(null);
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const handleCreate = useCallback(async (values: { name: string; maxConcurrency?: number }) => {
    try {
      setSubmitting(true);
      const nextInstallInfo = await createWorker({
        name: String(values.name ?? '').trim(),
        maxConcurrency: values.maxConcurrency ? Number(values.maxConcurrency) : undefined
      });
      setInstallInfo(nextInstallInfo);
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('workers.toast.created'));
      await loadWorkers();
    } catch (error: any) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [createForm, loadWorkers, message, t]);

  const handleUpdateStatus = useCallback(async (worker: WorkerRecord, status: 'offline' | 'disabled') => {
    setRowLoadingId(worker.id);
    try {
      await updateWorker(worker.id, { status });
      message.success(t('workers.toast.updated'));
      await loadWorkers();
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.updateFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, t]);

  const handleResetBindCode = useCallback(async (worker: WorkerRecord) => {
    setRowLoadingId(worker.id);
    try {
      const nextInstallInfo = await resetWorkerBindCode(worker.id);
      setInstallInfo(nextInstallInfo);
      message.success(t('workers.toast.bindCodeReset'));
      await loadWorkers();
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.bindCodeResetFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, t]);

  const handleDelete = useCallback(async (worker: WorkerRecord) => {
    setRowLoadingId(worker.id);
    try {
      await deleteWorker(worker.id);
      message.success(t('workers.toast.deleted'));
      await loadWorkers();
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.deleteFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, t]);

  const handlePrepareRuntime = useCallback(async () => {
    if (!prepareOpen) return;
    try {
      const values = await prepareForm.validateFields();
      setPrepareLoadingId(prepareOpen.id);
      await prepareWorkerRuntime(prepareOpen.id, values.providers);
      message.success(t('workers.toast.runtimeRequested'));
      setPrepareOpen(null);
      await loadWorkers();
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.runtimeRequestFailed'));
    } finally {
      setPrepareLoadingId(null);
    }
  }, [loadWorkers, message, prepareForm, prepareOpen, t]);

  const columns = useMemo<ColumnsType<WorkerRecord>>(
    () => [
      {
        title: t('workers.table.worker'),
        dataIndex: 'name',
        key: 'name',
        width: 280,
        render: (_value, record) => (
          <Space direction="vertical" size={2}>
            <Space size={8} wrap>
              <WorkerSummaryTag worker={record} />
              {record.systemManaged ? <Tag>{t('workers.common.systemManaged')}</Tag> : null}
              {record.preview ? <Tag color="geekblue">{t('workers.common.preview')}</Tag> : null}
              {requiresWorkerUpgrade(record) ? <Tag color="red">{t('workers.version.upgradeRequired')}</Tag> : null}
            </Space>
            <Typography.Text type="secondary">{formatWorkerOptionLabel(t, record)}</Typography.Text>
          </Space>
        )
      },
      {
        title: t('workers.table.runtime'),
        key: 'runtime',
        width: 260,
        render: (_value, record) => {
          const runtimeStatus = resolveRuntimeStatus(record);
          const providerText = describeRuntimeProviders(resolveRuntimeProviders(record));
          return (
            <Space direction="vertical" size={2}>
              <Typography.Text>{getWorkerRuntimeStatusLabel(t, runtimeStatus)}</Typography.Text>
              <Typography.Text type="secondary">{t('workers.field.providers')}: {providerText}</Typography.Text>
              {record.runtimeState?.lastPrepareError ? (
                <Typography.Text type="danger">{record.runtimeState.lastPrepareError}</Typography.Text>
              ) : null}
            </Space>
          );
        }
      },
      {
        title: t('workers.table.connection'),
        key: 'connection',
        width: 220,
        render: (_value, record) => {
          const versionStateText = describeWorkerVersionState(t, record, versionRequirement);
          return (
            <Space direction="vertical" size={2}>
              <Typography.Text>{record.hostname || '-'}</Typography.Text>
              <Typography.Text type="secondary">{record.version || '-'}</Typography.Text>
              {versionStateText ? <Typography.Text type="danger">{versionStateText}</Typography.Text> : null}
              <Typography.Text type="secondary">{t('workers.field.lastSeenAt')}: {formatDateTime(locale, record.lastSeenAt)}</Typography.Text>
            </Space>
          );
        }
      },
      {
        title: t('workers.table.concurrency'),
        key: 'concurrency',
        width: 120,
        render: (_value, record) => <Typography.Text>{record.currentConcurrency}/{record.maxConcurrency}</Typography.Text>
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 320,
        fixed: 'right',
        render: (_value, record) => {
          const isBusy = rowLoadingId === record.id;
          const isPreparing = prepareLoadingId === record.id;
          const nextStatus = record.status === 'disabled' ? 'offline' : 'disabled';
          const toggleLabel = record.status === 'disabled' ? t('workers.action.enable') : t('workers.action.disable');
          return (
            <Space size={8} wrap>
              <Button
                size="small"
                loading={isPreparing}
                disabled={record.status !== 'online' || requiresWorkerUpgrade(record)}
                onClick={() => {
                  prepareForm.setFieldsValue({ providers: ['codex', 'claude_code', 'gemini_cli'] });
                  setPrepareOpen(record);
                }}
              >
                {t('workers.action.prepareRuntime')}
              </Button>
              <Button size="small" loading={isBusy} disabled={record.systemManaged} onClick={() => void handleUpdateStatus(record, nextStatus)}>
                {toggleLabel}
              </Button>
              {!record.systemManaged ? (
                <Button size="small" loading={isBusy} onClick={() => void handleResetBindCode(record)}>
                  {t('workers.action.resetBindCode')}
                </Button>
              ) : null}
              {!record.systemManaged ? (
                <Popconfirm
                  title={t('workers.action.deleteConfirmTitle')}
                  description={t('workers.action.deleteConfirmDesc')}
                  onConfirm={() => void handleDelete(record)}
                >
                  <Button size="small" danger loading={isBusy}>
                    {t('common.delete')}
                  </Button>
                </Popconfirm>
              ) : null}
            </Space>
          );
        }
      }
    ],
    [handleDelete, handlePrepareRuntime, handleResetBindCode, handleUpdateStatus, locale, prepareForm, prepareLoadingId, rowLoadingId, t, versionRequirement]
  );

  const installScripts = installInfo ? buildInstallScripts(installInfo) : null;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert showIcon type="info" message={t('workers.help.title')} description={t('workers.help.desc')} />
      {versionRequirement ? (
        <Alert
          showIcon
          type="warning"
          message={t('workers.version.policyTitle')}
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>{t('workers.version.policyDesc', { packageName: versionRequirement.packageName, version: versionRequirement.requiredVersion })}</Typography.Text>
              <Typography.Text copyable={{ text: versionRequirement.npmInstallCommand }}>
                {t('workers.version.npmCommand')}: {versionRequirement.npmInstallCommand}
              </Typography.Text>
              <Typography.Text copyable={{ text: versionRequirement.cliUpgradeCommand }}>
                {t('workers.version.cliCommand')}: {versionRequirement.cliUpgradeCommand}
              </Typography.Text>
            </Space>
          }
        />
      ) : null}

      <Card
        size="small"
        title={t('workers.page.title')}
        extra={
          <Space>
            <Button onClick={() => void loadWorkers()}>{t('common.refresh')}</Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>{t('workers.action.create')}</Button>
          </Space>
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table
            className={SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME}
            rowKey="id"
            dataSource={workers}
            columns={columns}
            scroll={{ x: SETTINGS_DATA_TABLE_SCROLL_X }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{ emptyText: t('workers.empty') }}
          />
        )}
      </Card>

      <Modal
        className="hc-dialog--compact"
        title={t('workers.modal.createTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" initialValues={{ maxConcurrency: 1 }} requiredMark={false} onFinish={(values) => void handleCreate(values)}>
          <Form.Item
            label={t('workers.field.name')}
            name="name"
            rules={[{ required: true, transform: (value) => (typeof value === 'string' ? value.trim() : value), message: t('panel.validation.required') }]}
          >
            <Input placeholder={t('workers.placeholder.name')} />
          </Form.Item>
          <Form.Item label={t('workers.field.maxConcurrency')} name="maxConcurrency">
            <Select options={[1, 2, 3, 4].map((value) => ({ value, label: String(value) }))} placeholder={t('workers.placeholder.maxConcurrency')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="hc-dialog--compact"
        title={t('workers.install.title', { name: installInfo?.worker?.name || '' })}
        open={Boolean(installInfo)}
        onCancel={() => setInstallInfo(null)}
        footer={[
          <Button key="close" onClick={() => setInstallInfo(null)}>
            {t('common.close')}
          </Button>
        ]}
        width={860}
        destroyOnHidden
      >
        {installInfo && installScripts ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert showIcon type="info" message={t('workers.install.manualTitle')} description={t('workers.install.manualDesc')} />
            <Alert
              showIcon
              type="warning"
              message={t('workers.version.policyTitle')}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text>{t('workers.install.versionPinned', { packageName: installInfo.versionRequirement.packageName, version: installInfo.versionRequirement.requiredVersion })}</Typography.Text>
                  <Typography.Text copyable={{ text: installInfo.versionRequirement.npmInstallCommand }}>
                    {t('workers.version.npmCommand')}: {installInfo.versionRequirement.npmInstallCommand}
                  </Typography.Text>
                  <Typography.Text copyable={{ text: installInfo.versionRequirement.cliUpgradeCommand }}>
                    {t('workers.version.cliCommand')}: {installInfo.versionRequirement.cliUpgradeCommand}
                  </Typography.Text>
                </Space>
              }
            />
            <Typography.Paragraph copyable={{ text: installInfo.bindCode }}>
              <strong>{t('workers.install.bindCode')}:</strong> {installInfo.bindCode}
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>{t('workers.install.expiresAt')}:</strong> {formatDateTime(locale, installInfo.bindCodeExpiresAt)}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              {t('workers.install.workDirHint', { workerId: installInfo.worker.id })}
            </Typography.Paragraph>
            <Tabs
              items={[
                { key: 'macos', label: 'macOS', children: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.macos}</pre> },
                { key: 'linux', label: 'Linux', children: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.linux}</pre> },
                { key: 'windows', label: 'Windows', children: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.windows}</pre> }
              ]}
            />
          </Space>
        ) : null}
      </Modal>

      <Modal
        className="hc-dialog--compact"
        title={t('workers.modal.prepareTitle', { name: prepareOpen?.name || '' })}
        open={Boolean(prepareOpen)}
        onCancel={() => setPrepareOpen(null)}
        onOk={() => void handlePrepareRuntime()}
        confirmLoading={Boolean(prepareOpen && prepareLoadingId === prepareOpen.id)}
        okText={t('workers.action.prepareRuntime')}
        cancelText={t('common.cancel')}
      >
        <Form form={prepareForm} layout="vertical" initialValues={{ providers: ['codex', 'claude_code', 'gemini_cli'] }}>
          <Form.Item label={t('workers.field.providers')} name="providers">
            <Select mode="multiple" options={DEFAULT_PROVIDER_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
