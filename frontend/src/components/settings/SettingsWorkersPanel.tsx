import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Select, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createWorker,
  deleteWorker,
  fetchWorkersRegistry,
  rotateWorkerApiKey,
  updateWorker,
  type WorkerApiKeyInfo,
  type WorkerRecord,
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { useLocale, useT, type TFunction } from '../../i18n';
import {
  getWorkerProviderLabel,
  isWorkerProviderAvailable,
  WORKER_PROVIDER_KEYS
} from '../../utils/workerRuntime';
import { formatWorkerOptionLabel } from '../../utils/workers';
import { WorkerSummaryTag } from '../workers/WorkerSummaryTag';
import { SETTINGS_DATA_TABLE_SCROLL_X, SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME } from './layout';

const DEFAULT_PROVIDER_OPTIONS = WORKER_PROVIDER_KEYS.map((provider) => ({
  value: provider,
  label: getWorkerProviderLabel(provider)
}));

const dotenvQuote = (value: string): string => JSON.stringify(String(value));

const formatDateTime = (locale: string, value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const buildInstallScripts = (info: WorkerApiKeyInfo, backendUrl: string) => {
  const worker = info.worker;
  const unixWorkDir = `"$HOME/.hookcode/workers/${worker.id}"`;
  const linuxWorkDir = `/var/lib/hookcode/workers/${worker.id}`;
  const systemdEnvPath = `/etc/hookcode-worker/${worker.id}.env`;
  const systemdUnitName = `hookcode-worker-${worker.id}.service`;
  const workerName = worker.name || 'HookCode Worker';
  const concurrency = String(worker.maxConcurrency || 1);
  const installCommand = 'npm install -g @hookvibe/hookcode-worker';
  const workerDevEnv = [
    `HOOKCODE_WORK_DIR=${dotenvQuote(`~/.hookcode/workers/${worker.id}`)}`,
    `HOOKCODE_WORKER_API_KEY=${dotenvQuote(info.apiKey)}`,
    `HOOKCODE_WORKER_BACKEND_URL=${dotenvQuote(backendUrl)}`,
    'HOOKCODE_WORKER_KIND=remote',
    `HOOKCODE_WORKER_NAME=${dotenvQuote(workerName)}`,
    `HOOKCODE_WORKER_MAX_CONCURRENCY=${concurrency}`
  ].join('\n');
  const linuxEnvFile = [
    `HOOKCODE_WORK_DIR=${linuxWorkDir}`,
    `HOOKCODE_WORKER_API_KEY='${info.apiKey}'`,
    `HOOKCODE_WORKER_BACKEND_URL='${backendUrl}'`,
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
    manual: [
      `mkdir -p ${unixWorkDir}`,
      installCommand,
      `export HOOKCODE_WORKER_API_KEY='${info.apiKey}'`,
      `export HOOKCODE_WORKER_BACKEND_URL='${backendUrl}'`,
      `export HOOKCODE_WORK_DIR=${unixWorkDir}`,
      `export HOOKCODE_WORKER_KIND=remote`,
      `export HOOKCODE_WORKER_NAME='${workerName.replace(/'/g, `'\\''`)}'`,
      `export HOOKCODE_WORKER_MAX_CONCURRENCY='${concurrency}'`,
      'hookcode-worker run'
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
  };
};

export const SettingsWorkersPanel: FC = () => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [defaultBackendUrl, setDefaultBackendUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [installInfo, setInstallInfo] = useState<{ info: WorkerApiKeyInfo; backendUrl: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rotateConfirmWorker, setRotateConfirmWorker] = useState<WorkerRecord | null>(null);
  const [createForm] = Form.useForm<{ name: string; maxConcurrency?: number; providers: string[] }>();
  const globalDefaultWorker = useMemo(() => workers.find((worker) => worker.isGlobalDefault) ?? null, [workers]);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWorkersRegistry();
      setWorkers(data.workers);
      setDefaultBackendUrl(data.defaultBackendUrl || '');
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.fetchFailed'));
      setWorkers([]);
      setDefaultBackendUrl('');
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const handleCreate = useCallback(async (values: { name: string; maxConcurrency?: number; providers: string[] }) => {
    try {
      setSubmitting(true);
      const result = await createWorker({
        name: String(values.name ?? '').trim(),
        maxConcurrency: values.maxConcurrency ? Number(values.maxConcurrency) : undefined,
        providers: values.providers,
      });
      setInstallInfo({ info: result, backendUrl: defaultBackendUrl });
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
  }, [createForm, defaultBackendUrl, loadWorkers, message, t]);

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

  const handleToggleGlobalDefault = useCallback(async (worker: WorkerRecord, nextIsGlobalDefault: boolean) => {
    setRowLoadingId(worker.id);
    try {
      await updateWorker(worker.id, { isGlobalDefault: nextIsGlobalDefault });
      message.success(t('workers.toast.updated'));
      await loadWorkers();
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.updateFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [loadWorkers, message, t]);

  const handleRotateApiKey = useCallback(async () => {
    if (!rotateConfirmWorker) return;
    setRowLoadingId(rotateConfirmWorker.id);
    try {
      const result = await rotateWorkerApiKey(rotateConfirmWorker.id);
      setInstallInfo({ info: result, backendUrl: defaultBackendUrl });
      setRotateConfirmWorker(null);
      message.success(t('workers.toast.apiKeyRotated'));
      await loadWorkers();
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.apiKeyRotateFailed'));
    } finally {
      setRowLoadingId(null);
    }
  }, [defaultBackendUrl, loadWorkers, message, rotateConfirmWorker, t]);

  const openCreateModal = useCallback(() => {
    createForm.resetFields();
    createForm.setFieldsValue({ name: '', maxConcurrency: 1, providers: ['codex', 'claude_code', 'gemini_cli'] });
    setCreateOpen(true);
  }, [createForm]);

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
            </Space>
            <Typography.Text type="secondary">{formatWorkerOptionLabel(t, record)}</Typography.Text>
          </Space>
        )
      },
      {
        title: t('workers.table.providers'),
        key: 'providers',
        width: 300,
        render: (_value, record) => {
          const available = WORKER_PROVIDER_KEYS.filter((p) => isWorkerProviderAvailable(record, p));
          return (
            <Space direction="vertical" size={4}>
              <Typography.Text type="secondary">{t('workers.field.providers')}: {available.length}/{WORKER_PROVIDER_KEYS.length}</Typography.Text>
              <Space size={4} wrap>
                {WORKER_PROVIDER_KEYS.map((provider) => {
                  const isAvail = isWorkerProviderAvailable(record, provider);
                  return (
                    <Tag key={provider} color={isAvail ? 'success' : 'default'}>
                      {getWorkerProviderLabel(provider)}
                    </Tag>
                  );
                })}
              </Space>
            </Space>
          );
        }
      },
      {
        title: t('workers.table.connection'),
        key: 'connection',
        width: 220,
        render: (_value, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text>{record.hostname || '-'}</Typography.Text>
            <Typography.Text type="secondary">{record.version || '-'}</Typography.Text>
            {record.apiKeyPrefix ? (
              <Typography.Text type="secondary">{t('workers.field.apiKeyPrefix')}: {record.apiKeyPrefix}…</Typography.Text>
            ) : null}
            <Typography.Text type="secondary">{t('workers.field.lastHeartbeatAt')}: {formatDateTime(locale, record.lastHeartbeatAt)}</Typography.Text>
          </Space>
        )
      },
      {
        title: t('workers.table.concurrency'),
        key: 'concurrency',
        width: 120,
        render: (_value, record) => <Typography.Text>{record.activeTaskCount}/{record.maxConcurrency}</Typography.Text>
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 320,
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
                <Button size="small" loading={isBusy} onClick={() => setRotateConfirmWorker(record)}>
                  {t('workers.action.rotateApiKey')}
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
    [handleDelete, handleToggleGlobalDefault, handleUpdateStatus, locale, rowLoadingId, t]
  );

  const installScripts = installInfo ? buildInstallScripts(installInfo.info, installInfo.backendUrl) : null;

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

      <Card
        size="small"
        title={t('workers.page.title')}
        extra={
          <Space>
            <Button onClick={() => void loadWorkers()}>{t('common.refresh')}</Button>
            <Button type="primary" onClick={openCreateModal}>{t('workers.action.create')}</Button>
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

      {/* Create worker modal */}
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
          <Form.Item label={t('workers.field.providers')} name="providers">
            <Select mode="multiple" options={DEFAULT_PROVIDER_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rotate API key confirmation modal */}
      <Modal
        className="hc-dialog--compact"
        title={t('workers.modal.rotateTitle', { name: rotateConfirmWorker?.name || '' })}
        open={Boolean(rotateConfirmWorker)}
        onCancel={() => setRotateConfirmWorker(null)}
        onOk={() => void handleRotateApiKey()}
        confirmLoading={Boolean(rotateConfirmWorker && rowLoadingId === rotateConfirmWorker.id)}
        okText={t('workers.action.rotateApiKey')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Typography.Paragraph>{t('workers.modal.rotateConfirm')}</Typography.Paragraph>
      </Modal>

      {/* Install / API key info modal */}
      <Modal
        className="hc-dialog--compact"
        title={t('workers.install.title', { name: installInfo?.info?.worker?.name || '' })}
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
            <Alert showIcon type="warning" message={t('workers.install.apiKeyWarning')} />
            <Typography.Paragraph copyable={{ text: installInfo.info.apiKey }}>
              <strong>{t('workers.install.apiKey')}:</strong> {installInfo.info.apiKey}
            </Typography.Paragraph>
            <Typography.Paragraph copyable={{ text: installInfo.backendUrl }}>
              <strong>{t('workers.install.backendUrl')}:</strong> {installInfo.backendUrl}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              {t('workers.install.workDirHint', { workerId: installInfo.info.worker.id })}
            </Typography.Paragraph>
            <Alert showIcon type="info" message={t('workers.install.manualTitle')} description={t('workers.install.manualDesc')} />
            <Tabs
              items={[
                { key: 'manual', label: 'macOS / Linux', children: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installScripts.manual}</pre> },
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
                }
              ]}
            />
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
};
