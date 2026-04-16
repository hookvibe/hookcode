import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Select, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createWorker,
  deleteWorker,
  fetchWorkersRegistry,
  resetWorkerBindCode,
  updateWorker,
  type WorkerBindInfo,
  type WorkerRecord,
  type WorkerVersionRequirement
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { useLocale, useT, type TFunction } from '../../i18n';
import {
  getWorkerProviderGuardDetails,
  getWorkerProviderLabel,
  getWorkerProviderRuntimeEntry,
  getWorkerProviderRuntimeStatus,
  isWorkerProviderReady,
  WORKER_PROVIDER_KEYS
} from '../../utils/workerRuntime';
import { formatWorkerOptionLabel, getWorkerRuntimeStatusLabel } from '../../utils/workers';
import { WorkerSummaryTag } from '../workers/WorkerSummaryTag';
import { SETTINGS_DATA_TABLE_SCROLL_X, SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME } from './layout';
const WORKER_ENV_POLL_INTERVAL_MS = 5_000;
type LoadWorkersMode = 'initial' | 'manual' | 'silent';

const powerShellQuote = (value: string): string => `'${String(value).replace(/'/g, "''")}'`;
const dotenvQuote = (value: string): string => JSON.stringify(String(value));

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isValidBackendUrl = (value: string): boolean => {
  const raw = trimString(value);
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const formatDateTime = (locale: string, value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const resolveRuntimeStatus = (worker: WorkerRecord): 'idle' | 'ready' | 'error' => {
  const statuses = WORKER_PROVIDER_KEYS.map((provider) => getWorkerProviderRuntimeStatus(worker, provider));
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('ready')) return 'ready';
  return 'idle';
};

const getProviderTagColor = (status: ReturnType<typeof getWorkerProviderRuntimeStatus>): string => {
  if (status === 'ready') return 'success';
  if (status === 'error') return 'error';
  return 'default';
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
  const linuxWorkDir = `/var/lib/hookcode/workers/${worker.id}`;
  const systemdEnvPath = `/etc/hookcode-worker/${worker.id}.env`;
  const systemdUnitName = `hookcode-worker-${worker.id}.service`;
  const workerName = worker.name || 'HookCode Worker';
  const concurrency = String(worker.maxConcurrency || 1);
  const installCommand = `npm install -g @hookvibe/hookcode-worker@${requiredVersion}`;
  const workerDevEnv = [
    `HOOKCODE_WORK_DIR=${dotenvQuote(`~/.hookcode/workers/${worker.id}`)}`,
    `HOOKCODE_WORKER_BIND_CODE=${dotenvQuote(info.bindCode)}`,
    'HOOKCODE_WORKER_KIND=remote',
    `HOOKCODE_WORKER_NAME=${dotenvQuote(workerName)}`,
    `HOOKCODE_WORKER_MAX_CONCURRENCY=${concurrency}`
  ].join('\n');
  const linuxEnvFile = [
    `HOOKCODE_WORK_DIR=${linuxWorkDir}`,
    `HOOKCODE_WORKER_BIND_CODE='${info.bindCode}'`,
    'HOOKCODE_WORKER_KIND=remote',
    `HOOKCODE_WORKER_NAME='${workerName.replace(/'/g, `'\\''`)}'`,
    `HOOKCODE_WORKER_MAX_CONCURRENCY='${concurrency}'`
  ].join('\n');
  const linuxSystemdUnit = [
    '[Unit]',
    `Description=HookCode Worker (${workerName})`,
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `EnvironmentFile=${systemdEnvPath}`,
    `WorkingDirectory=${linuxWorkDir}`,
    'ExecStart=/usr/bin/env hookcode-worker run',
    'Restart=always',
    'RestartSec=5',
    '',
    '[Install]',
    'WantedBy=multi-user.target'
  ].join('\n');

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
    linuxSystemdSetup: [
      `sudo mkdir -p /etc/hookcode-worker ${linuxWorkDir}`,
      `sudo ${installCommand}`,
      `sudo tee ${systemdEnvPath} >/dev/null <<'EOF'`,
      linuxEnvFile,
      'EOF',
      `sudo tee /etc/systemd/system/${systemdUnitName} >/dev/null <<'EOF'`,
      linuxSystemdUnit,
      'EOF',
      'sudo systemctl daemon-reload',
      `sudo systemctl enable --now ${systemdUnitName}`,
      `sudo systemctl status ${systemdUnitName} --no-pager`
    ].join('\n'),
    linuxSystemdEnv: linuxEnvFile,
    linuxSystemdUnit,
    linuxSystemdUnitName: systemdUnitName,
    workerDevEnv,
    workerDevCommand: 'pnpm dev',
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
  const [defaultBackendUrl, setDefaultBackendUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [installInfo, setInstallInfo] = useState<WorkerBindInfo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm<{ name: string; maxConcurrency?: number; backendUrl: string }>();
  const [resetForm] = Form.useForm<{ backendUrl: string }>();
  const [resetOpen, setResetOpen] = useState<WorkerRecord | null>(null);
  const globalDefaultWorker = useMemo(() => workers.find((worker) => worker.isGlobalDefault) ?? null, [workers]);

  const loadWorkers = useCallback(async (mode: LoadWorkersMode = 'manual') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'manual') setRefreshing(true);
    try {
      const data = await fetchWorkersRegistry();
      setWorkers(data.workers);
      setVersionRequirement(data.versionRequirement);
      setDefaultBackendUrl(data.defaultBackendUrl || '');
      setHasLoadedOnce(true);
    } catch (error) {
      console.error(error);
      if (mode !== 'silent') {
        message.error(getApiErrorMessage(error) || t('workers.toast.fetchFailed'));
      }
      if (mode === 'initial') {
        setWorkers([]);
        setVersionRequirement(null);
        setDefaultBackendUrl('');
      }
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'manual') setRefreshing(false);
    }
  }, [message, t]);

  useEffect(() => {
    void loadWorkers('initial');
  }, [loadWorkers]);

  useEffect(() => {
    // Poll worker environment status so Codex/Claude/Gemini availability refreshes shortly after admins install or fix a global CLI on the remote machine. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
    const timer = window.setInterval(() => {
      void loadWorkers('silent');
    }, WORKER_ENV_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadWorkers]);

  const handleCreate = useCallback(async (values: { name: string; maxConcurrency?: number; backendUrl: string }) => {
    try {
      setSubmitting(true);
      const nextInstallInfo = await createWorker({
        name: String(values.name ?? '').trim(),
        maxConcurrency: values.maxConcurrency ? Number(values.maxConcurrency) : undefined,
        backendUrl: trimString(values.backendUrl)
      });
      setInstallInfo(nextInstallInfo);
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('workers.toast.created'));
      await loadWorkers('silent');
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
      await loadWorkers('silent');
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.updateFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, t]);

  const handleToggleGlobalDefault = useCallback(async (worker: WorkerRecord, nextIsGlobalDefault: boolean) => {
    setRowLoadingId(worker.id);
    try {
      await updateWorker(worker.id, { isGlobalDefault: nextIsGlobalDefault });
      message.success(t('workers.toast.updated'));
      await loadWorkers('silent');
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.updateFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, t]);

  const handleResetBindCode = useCallback(async (worker: WorkerRecord) => {
    resetForm.setFieldsValue({ backendUrl: trimString(worker.backendBaseUrl) || defaultBackendUrl });
    setResetOpen(worker);
  }, [defaultBackendUrl, resetForm]);

  const handleConfirmResetBindCode = useCallback(async () => {
    if (!resetOpen) return;
    setRowLoadingId(resetOpen.id);
    try {
      const values = await resetForm.validateFields();
      const nextInstallInfo = await resetWorkerBindCode(resetOpen.id, trimString(values.backendUrl));
      setInstallInfo(nextInstallInfo);
      setResetOpen(null);
      resetForm.resetFields();
      message.success(t('workers.toast.bindCodeReset'));
      await loadWorkers('silent');
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.bindCodeResetFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, resetForm, resetOpen, t]);

  const openCreateModal = useCallback(() => {
    createForm.resetFields();
    createForm.setFieldsValue({ name: '', maxConcurrency: 1, backendUrl: defaultBackendUrl });
    setCreateOpen(true);
  }, [createForm, defaultBackendUrl]);

  useEffect(() => {
    if (!createOpen) return;
    if (trimString(createForm.getFieldValue('backendUrl'))) return;
    createForm.setFieldsValue({ backendUrl: defaultBackendUrl });
  }, [createForm, createOpen, defaultBackendUrl]);

  const renderBackendUrlHelp = useMemo(
    () => (
      <Typography.Text type="secondary">
        {t('workers.field.backendUrlHelp', { defaultUrl: defaultBackendUrl || '-' })}
      </Typography.Text>
    ),
    [defaultBackendUrl, t]
  );

  const handleDelete = useCallback(async (worker: WorkerRecord) => {
    setRowLoadingId(worker.id);
    try {
      await deleteWorker(worker.id);
      message.success(t('workers.toast.deleted'));
      await loadWorkers('silent');
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.deleteFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, t]);

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
              {record.isGlobalDefault ? <Tag color="gold">{t('workers.common.globalDefault')}</Tag> : null}
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
        width: 420,
        render: (_value, record) => {
          const runtimeStatus = resolveRuntimeStatus(record);
          const readyCount = WORKER_PROVIDER_KEYS.filter((provider) => isWorkerProviderReady(record, provider)).length;
          return (
            <Space direction="vertical" size={6}>
              <Typography.Text>{getWorkerRuntimeStatusLabel(t, runtimeStatus)}</Typography.Text>
              <Typography.Text type="secondary">{t('workers.field.providers')}: {readyCount}/{WORKER_PROVIDER_KEYS.length}</Typography.Text>
              {record.runtimeState?.lastCheckedAt ? (
                <Typography.Text type="secondary">
                  {t('workers.field.lastCheckedAt')}: {formatDateTime(locale, record.runtimeState.lastCheckedAt)}
                </Typography.Text>
              ) : null}
              {WORKER_PROVIDER_KEYS.map((provider) => {
                const status = getWorkerProviderRuntimeStatus(record, provider);
                const entry = getWorkerProviderRuntimeEntry(record.runtimeState, provider);
                const guard = getWorkerProviderGuardDetails({
                  workerName: record.name || record.id,
                  provider,
                  worker: record
                });
                const guardMessage =
                  guard?.reason === 'error'
                      ? t('workers.runtime.providerErrorHint', {
                          provider: guard.providerLabel,
                          worker: guard.workerName,
                          error: guard.error || record.runtimeState?.lastCheckError || '-'
                        })
                      : guard?.reason === 'missing'
                        ? t('workers.runtime.providerMissingHint', { provider: guard.providerLabel, worker: guard.workerName })
                        : null;
                return (
                  <Space key={provider} direction="vertical" size={1} style={{ width: '100%' }}>
                    <Space size={6} wrap>
                      <Typography.Text strong>{getWorkerProviderLabel(provider)}</Typography.Text>
                      <Tag color={getProviderTagColor(status)}>{getWorkerRuntimeStatusLabel(t, status)}</Tag>
                    </Space>
                    {entry?.version ? (
                      <Typography.Text type="secondary">
                        {t('workers.field.version')}: {entry.version}
                      </Typography.Text>
                    ) : null}
                    {entry?.path ? (
                      <Typography.Text type="secondary">
                        {t('workers.field.path')}: {entry.path}
                      </Typography.Text>
                    ) : null}
                    {!entry?.path && entry?.command ? (
                      <Typography.Text type="secondary">
                        {t('workers.field.command')}: {entry.command}
                      </Typography.Text>
                    ) : null}
                    {entry?.error ? <Typography.Text type="danger">{entry.error}</Typography.Text> : null}
                    {!entry?.error && status !== 'ready' && guardMessage ? (
                      <Typography.Text type="secondary">{guardMessage}</Typography.Text>
                    ) : null}
                  </Space>
                );
              })}
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
        width: 240,
        fixed: 'right',
        render: (_value, record) => {
          const isBusy = rowLoadingId === record.id;
          const nextStatus = record.status === 'disabled' ? 'offline' : 'disabled';
          const toggleLabel = record.status === 'disabled' ? t('workers.action.enable') : t('workers.action.disable');
          const defaultToggleLabel = record.isGlobalDefault ? t('workers.action.unsetDefault') : t('workers.action.setDefault');
          return (
            <Space size={8} wrap>
              <Button
                size="small"
                loading={isBusy}
                onClick={() => void handleToggleGlobalDefault(record, !record.isGlobalDefault)}
              >
                {defaultToggleLabel}
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
    [handleDelete, handleResetBindCode, handleToggleGlobalDefault, handleUpdateStatus, locale, rowLoadingId, t, versionRequirement]
  );

  const installScripts = installInfo ? buildInstallScripts(installInfo) : null;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert showIcon type="info" message={t('workers.help.title')} description={t('workers.help.desc')} />
      {!globalDefaultWorker ? (
        <Alert showIcon type="warning" message={t('workers.default.missingTitle')} description={t('workers.default.missingDesc')} />
      ) : null}
      {globalDefaultWorker && globalDefaultWorker.status !== 'online' ? (
        <Alert
          showIcon
          type="error"
          message={t('workers.default.offlineTitle', { name: globalDefaultWorker.name })}
          description={t('workers.default.offlineDesc')}
        />
      ) : null}
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
            <Button loading={refreshing} onClick={() => void loadWorkers('manual')}>{t('common.refresh')}</Button>
            <Button type="primary" onClick={openCreateModal}>{t('workers.action.create')}</Button>
          </Space>
        }
      >
        {loading && !hasLoadedOnce ? (
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
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" requiredMark={false} onFinish={(values) => void handleCreate(values)}>
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
          <Form.Item
            label={t('workers.field.backendUrl')}
            name="backendUrl"
            extra={renderBackendUrlHelp}
            rules={[
              { required: true, transform: (value) => trimString(value), message: t('panel.validation.required') },
              {
                validator: async (_rule, value) => {
                  if (isValidBackendUrl(String(value ?? ''))) return;
                  throw new Error(t('workers.validation.backendUrl'));
                }
              }
            ]}
          >
            <Input placeholder={t('workers.placeholder.backendUrl')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="hc-dialog--compact"
        title={t('workers.modal.resetTitle', { name: resetOpen?.name || '' })}
        open={Boolean(resetOpen)}
        onCancel={() => {
          setResetOpen(null);
          resetForm.resetFields();
        }}
        onOk={() => void handleConfirmResetBindCode()}
        confirmLoading={Boolean(resetOpen && rowLoadingId === resetOpen.id)}
        okText={t('workers.action.resetBindCode')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={resetForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label={t('workers.field.backendUrl')}
            name="backendUrl"
            extra={renderBackendUrlHelp}
            rules={[
              { required: true, transform: (value) => trimString(value), message: t('panel.validation.required') },
              {
                validator: async (_rule, value) => {
                  if (isValidBackendUrl(String(value ?? ''))) return;
                  throw new Error(t('workers.validation.backendUrl'));
                }
              }
            ]}
          >
            <Input placeholder={t('workers.placeholder.backendUrl')} />
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
            <Typography.Paragraph copyable={{ text: installInfo.backendUrl }}>
              <strong>{t('workers.install.backendUrl')}:</strong> {installInfo.backendUrl}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              {t('workers.install.workDirHint', { workerId: installInfo.worker.id })}
            </Typography.Paragraph>
            <Tabs
              items={[
                { key: 'macos', label: 'macOS', children: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.macos}</pre> },
                {
                  key: 'worker-dev',
                  label: 'hookcode-worker dev',
                  children: (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Alert showIcon type="success" message={t('workers.install.devTitle')} description={t('workers.install.devDesc')} />
                      <Typography.Text strong>{t('workers.install.devEnvFile')}</Typography.Text>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.workerDevEnv}</pre>
                      <Typography.Text strong>{t('workers.install.devCommand')}</Typography.Text>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.workerDevCommand}</pre>
                    </Space>
                  )
                },
                {
                  key: 'linux-systemd',
                  label: 'Linux (systemd)',
                  children: (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Alert showIcon type="success" message={t('workers.install.systemdTitle')} description={t('workers.install.systemdDesc')} />
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.linuxSystemdSetup}</pre>
                      <Typography.Text strong>{t('workers.install.systemdEnvFile')}</Typography.Text>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.linuxSystemdEnv}</pre>
                      <Typography.Text strong>{t('workers.install.systemdService')}</Typography.Text>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.linuxSystemdUnit}</pre>
                    </Space>
                  )
                },
                { key: 'linux', label: 'Linux (manual)', children: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.linux}</pre> },
                { key: 'windows', label: 'Windows', children: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.windows}</pre> }
              ]}
            />
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
};
