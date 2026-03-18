import { FC, useCallback, useMemo, useState } from 'react';
import { App, Button, Empty, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  fetchRepoWebhookDelivery,
  getApiErrorMessage,
  replayWebhookEvent,
  replayWebhookEventDryRun,
  type ReplayWebhookEventRequest,
  type RepoWebhookDeliveryDetail,
  type RepoWebhookDeliveryResult,
  type RepoWebhookDeliverySummary
} from '../../api';
import { useT } from '../../i18n';
import { ScrollableTable } from '../ScrollableTable';
import { renderWebhookResultTag, WebhookEventDetailView } from '../webhooks/WebhookEventDetailView';

/**
 * RepoWebhookDeliveriesPanel:
 * - Business context: inspect recent webhook deliveries to debug "why tasks did/didn't run".
 * - Module: RepoDetail -> Webhooks tab.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to `frontend-chat`.
 * - 2026-03-13: Added replay controls and debug timeline drill-down. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
 */

export interface RepoWebhookDeliveriesPanelProps {
  repoId: string;
  deliveries: RepoWebhookDeliverySummary[];
  loading: boolean;
  loadFailed: boolean;
  onRefresh: () => void;
  canManage?: boolean;
}

export const RepoWebhookDeliveriesPanel: FC<RepoWebhookDeliveriesPanelProps> = ({
  repoId,
  deliveries,
  loading,
  loadFailed,
  onRefresh,
  canManage = false
}) => {
  const t = useT();
  const { message } = App.useApp();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<RepoWebhookDeliveryDetail | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);

  // Rely on shared repo webhook deliveries to avoid duplicate dashboard requests. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const openDetail = useCallback(
    async (deliveryId: string) => {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);
      try {
        const data = await fetchRepoWebhookDelivery(repoId, deliveryId);
        setDetail(data);
      } catch (err) {
        console.error(err);
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [repoId]
  );

  const handleReplay = useCallback(
    async (input: ReplayWebhookEventRequest, options: { dryRun: boolean }) => {
      if (!detail) return;
      const setSubmitting = options.dryRun ? setDryRunLoading : setReplayLoading;
      setSubmitting(true);
      try {
        const next = options.dryRun
          ? await replayWebhookEventDryRun(detail.id, input)
          : await replayWebhookEvent(detail.id, input);
        setDetail(next);
        onRefresh();
        message.success(
          t(
            options.dryRun
              ? 'repos.webhookDeliveries.replay.dryRunSuccess'
              : 'repos.webhookDeliveries.replay.success'
          )
        );
      } catch (error) {
        message.error(
          getApiErrorMessage(error) ||
            t(
              options.dryRun
                ? 'repos.webhookDeliveries.replay.dryRunFailed'
                : 'repos.webhookDeliveries.replay.failed'
            )
        );
      } finally {
        setSubmitting(false);
      }
    },
    [detail, message, onRefresh, t]
  );

  const columns = useMemo(
    () => [
      {
        title: t('repos.webhookDeliveries.column.time'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 190,
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>
      },
      {
        title: t('common.platform'),
        dataIndex: 'provider',
        key: 'provider',
        width: 90,
        render: (value: string) => <Typography.Text>{value === 'github' ? 'GitHub' : 'GitLab'}</Typography.Text>
      },
      {
        title: t('repos.webhookDeliveries.column.event'),
        key: 'eventName',
        width: 220,
        render: (_: unknown, row: RepoWebhookDeliverySummary) => (
          <Space direction="vertical" size={2}>
            <Typography.Text>{row.eventName || '-'}</Typography.Text>
            <Typography.Text type="secondary">{row.mappedEventType || '-'}</Typography.Text>
          </Space>
        )
      },
      {
        title: t('repos.webhookDeliveries.column.result'),
        dataIndex: 'result',
        key: 'result',
        width: 110,
        render: (value: RepoWebhookDeliveryResult) => renderWebhookResultTag(t, value)
      },
      {
        title: t('repos.webhookDeliveries.column.status'),
        dataIndex: 'httpStatus',
        key: 'httpStatus',
        width: 90,
        render: (value: number) => <Typography.Text>{value}</Typography.Text>
      },
      {
        title: t('repos.webhookDeliveries.column.diagnosis'),
        key: 'diagnosis',
        width: 240,
        render: (_: unknown, row: RepoWebhookDeliverySummary) => (
          <Space size={6} wrap>
            {row.errorLayer ? <Tag color="red">{row.errorLayer}</Tag> : null}
            {row.replayMode ? (
              <Tag color="blue">{t(`repos.webhookDeliveries.replay.mode.${row.replayMode}` as const)}</Tag>
            ) : null}
            {row.signatureVerified === false ? (
              <Tag color="orange">{t('repos.webhookDeliveries.signature.failed')}</Tag>
            ) : null}
          </Space>
        )
      },
      {
        title: t('repos.webhookDeliveries.column.tasks'),
        key: 'tasks',
        width: 260,
        render: (_: unknown, row: RepoWebhookDeliverySummary) => {
          if (!row.taskIds?.length) return <Typography.Text type="secondary">-</Typography.Text>;
          return (
            <Space size={6} wrap>
              {row.taskIds.slice(0, 5).map((id) => (
                <Button
                  key={id}
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => (window.location.hash = `#/tasks/${id}`)}
                >
                  {id.slice(0, 8)}
                </Button>
              ))}
              {row.taskIds.length > 5 ? (
                <Typography.Text type="secondary">+{row.taskIds.length - 5}</Typography.Text>
              ) : null}
            </Space>
          );
        }
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 90,
        render: (_: unknown, row: RepoWebhookDeliverySummary) => (
          <Button type="link" size="small" onClick={() => void openDetail(row.id)}>
            {t('common.view')}
          </Button>
        )
      }
    ],
    [openDetail, t]
  );

  return (
    <>
      <Space size={8} style={{ marginBottom: 12 }} wrap>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          {t('common.refresh')}
        </Button>
        {loadFailed ? <Typography.Text type="danger">{t('repos.webhookDeliveries.loadFailed')}</Typography.Text> : null}
      </Space>

      <ScrollableTable<RepoWebhookDeliverySummary>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={deliveries}
        columns={columns as any}
        // Paginate deliveries to keep the repo dashboard layout compact while still allowing drill-down via the detail modal. u55e45ffi8jng44erdzp
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description={t('repos.webhookDeliveries.empty')} /> }}
      />

      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        title={t('repos.webhookDeliveries.detailTitle')}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('common.close')}</Button>}
        width={1100}
      >
        {detailLoading ? (
          <Skeleton active title={false} paragraph={{ rows: 12 }} />
        ) : detail ? (
          <WebhookEventDetailView
            event={detail}
            canReplay={canManage}
            replayLoading={replayLoading}
            dryRunLoading={dryRunLoading}
            onReplay={handleReplay}
            onOpenEvent={(eventId) => void openDetail(eventId)}
          />
        ) : (
          <Typography.Text type="secondary">{t('repos.webhookDeliveries.detailLoadFailed')}</Typography.Text>
        )}
      </Modal>
    </>
  );
};
