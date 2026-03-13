import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Select, Skeleton, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createWorker,
  deleteWorker,
  fetchWorkers,
  prepareWorkerRuntime,
  rotateWorkerToken,
  updateWorker,
  type WorkerBootstrapInfo,
  type WorkerRecord
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { useLocale, useT } from '../../i18n';
import { formatWorkerOptionLabel, getWorkerRuntimeStatusLabel } from '../../utils/workers';
import { WorkerSummaryTag } from '../workers/WorkerSummaryTag';
import { SETTINGS_DATA_TABLE_SCROLL_X, SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME } from './layout';

const DEFAULT_PROVIDER_OPTIONS = [
  { value: 'codex', label: 'Codex' },
  { value: 'claude_code', label: 'Claude Code' },
  { value: 'gemini_cli', label: 'Gemini CLI' }
];

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

// Render the admin worker registry with bootstrap, lifecycle, and runtime prep actions. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export const SettingsWorkersPanel: FC = () => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prepareLoadingId, setPrepareLoadingId] = useState<string | null>(null);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [bootstrapInfo, setBootstrapInfo] = useState<WorkerBootstrapInfo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState<WorkerRecord | null>(null);
  const [createForm] = Form.useForm<{ name: string; maxConcurrency?: number }>();
  const [prepareForm] = Form.useForm<{ providers: string[] }>();

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const nextWorkers = await fetchWorkers();
      setWorkers(nextWorkers);
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.fetchFailed'));
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

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
        render: (_value, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text>{record.hostname || '-'}</Typography.Text>
            <Typography.Text type="secondary">{record.version || '-'}</Typography.Text>
            <Typography.Text type="secondary">{t('workers.field.lastSeenAt')}: {formatDateTime(locale, record.lastSeenAt)}</Typography.Text>
          </Space>
        )
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
        width: 300,
        // Keep the worker action cluster pinned while the rest of the registry scrolls horizontally. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312
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
                disabled={record.status !== 'online'}
                onClick={() => {
                  prepareForm.setFieldsValue({ providers: ['codex', 'claude_code', 'gemini_cli'] });
                  setPrepareOpen(record);
                }}
              >
                {t('workers.action.prepareRuntime')}
              </Button>
              <Button
                size="small"
                loading={isBusy}
                disabled={record.systemManaged}
                onClick={() => void handleUpdateStatus(record, nextStatus)}
              >
                {toggleLabel}
              </Button>
              {!record.systemManaged ? (
                <Button size="small" loading={isBusy} onClick={() => void handleRotateToken(record)}>
                  {t('workers.action.rotateToken')}
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
    [locale, prepareForm, prepareLoadingId, rowLoadingId, t]
  );

  const handleCreate = useCallback(async (values: { name: string; maxConcurrency?: number }) => {
    try {
      setSubmitting(true);
      const nextBootstrap = await createWorker({
        name: String(values.name ?? '').trim(),
        maxConcurrency: values.maxConcurrency ? Number(values.maxConcurrency) : undefined
      });
      setBootstrapInfo(nextBootstrap);
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

  const handleRotateToken = useCallback(async (worker: WorkerRecord) => {
    setRowLoadingId(worker.id);
    try {
      const nextBootstrap = await rotateWorkerToken(worker.id);
      setBootstrapInfo(nextBootstrap);
      message.success(t('workers.toast.tokenRotated'));
      await loadWorkers();
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('workers.toast.rotateFailed'));
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

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert showIcon type="info" message={t('workers.help.title')} description={t('workers.help.desc')} />

      {bootstrapInfo ? (
        <Card size="small" title={t('workers.bootstrap.title')} extra={<Button type="link" onClick={() => setBootstrapInfo(null)}>{t('common.close')}</Button>}>
          {/* Keep newly generated worker secrets visible in one place so admins can finish remote bootstrap without reissuing tokens. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Paragraph copyable={{ text: bootstrapInfo.workerId }}>
              <strong>{t('workers.bootstrap.workerId')}:</strong> {bootstrapInfo.workerId}
            </Typography.Paragraph>
            <Typography.Paragraph copyable={{ text: bootstrapInfo.token }}>
              <strong>{t('workers.bootstrap.token')}:</strong> {bootstrapInfo.token}
            </Typography.Paragraph>
            <Typography.Paragraph copyable={{ text: bootstrapInfo.backendUrl }}>
              <strong>{t('workers.bootstrap.backendUrl')}:</strong> {bootstrapInfo.backendUrl}
            </Typography.Paragraph>
            <Typography.Paragraph copyable={{ text: bootstrapInfo.wsUrl }}>
              <strong>{t('workers.bootstrap.wsUrl')}:</strong> {bootstrapInfo.wsUrl}
            </Typography.Paragraph>
          </Space>
        </Card>
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
            // Let worker columns overflow horizontally while preserving a sticky action column on the right. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312
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

      {/* Use the shared compact dialog skin so worker creation matches the current theme surface. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312 */}
      <Modal
        className="hc-dialog--compact"
        title={t('workers.modal.createTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        // Submit through the AntD form instance so the latest input/IME composition state is committed before worker creation runs. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
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
            rules={[
              // Trim worker names before client-side validation so whitespace-only input never reaches the backend as a 400 create failure. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
              { required: true, transform: (value) => (typeof value === 'string' ? value.trim() : value), message: t('panel.validation.required') }
            ]}
          >
            <Input placeholder={t('workers.placeholder.name')} />
          </Form.Item>
          <Form.Item label={t('workers.field.maxConcurrency')} name="maxConcurrency">
            <Select
              options={[1, 2, 3, 4].map((value) => ({ value, label: String(value) }))}
              placeholder={t('workers.placeholder.maxConcurrency')}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Use the shared compact dialog skin so runtime preparation no longer renders as a mismatched dark block. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312 */}
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
