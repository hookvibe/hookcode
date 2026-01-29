import { FC, useCallback, useMemo, useState } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import { Button, Empty, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import type { RepoWebhookDeliveryDetail, RepoWebhookDeliveryResult, RepoWebhookDeliverySummary } from '../../api';
import { fetchRepoWebhookDelivery } from '../../api';
import { useT } from '../../i18n';
import { JsonViewer } from '../JsonViewer';
import { ScrollableTable } from '../ScrollableTable';

/**
 * RepoWebhookDeliveriesPanel:
 * - Business context: inspect recent webhook deliveries to debug "why tasks did/didn't run".
 * - Module: RepoDetail -> Webhooks tab.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to `frontend-chat`.
 */

const resultTag = (t: ReturnType<typeof useT>, result: RepoWebhookDeliveryResult) => {
  // Use i18n keys for webhook delivery result labels so the dashboard charts and table stay consistent. u55e45ffi8jng44erdzp
  if (result === 'accepted') return <Tag color="green">{t('repos.webhookDeliveries.result.accepted')}</Tag>;
  if (result === 'skipped') return <Tag>{t('repos.webhookDeliveries.result.skipped')}</Tag>;
  if (result === 'rejected') return <Tag color="orange">{t('repos.webhookDeliveries.result.rejected')}</Tag>;
  return <Tag color="red">{t('repos.webhookDeliveries.result.error')}</Tag>;
};

export interface RepoWebhookDeliveriesPanelProps {
  repoId: string;
  deliveries: RepoWebhookDeliverySummary[];
  loading: boolean;
  loadFailed: boolean;
  onRefresh: () => void;
}

export const RepoWebhookDeliveriesPanel: FC<RepoWebhookDeliveriesPanelProps> = ({
  repoId,
  deliveries,
  loading,
  loadFailed,
  onRefresh
}) => {
  const t = useT();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<RepoWebhookDeliveryDetail | null>(null);

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

  const columns = useMemo(
    () => [
      {
        title: t('repos.webhookDeliveries.column.time'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 190,
        render: (v: string) => <Typography.Text code>{v}</Typography.Text>
      },
      {
        title: t('common.platform'),
        dataIndex: 'provider',
        key: 'provider',
        width: 90,
        render: (v: string) => <Typography.Text>{v === 'github' ? 'GitHub' : 'GitLab'}</Typography.Text>
      },
      {
        title: t('repos.webhookDeliveries.column.event'),
        dataIndex: 'eventName',
        key: 'eventName',
        width: 220,
        render: (v: string) => (v ? <Typography.Text>{v}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text>)
      },
      {
        title: t('repos.webhookDeliveries.column.result'),
        dataIndex: 'result',
        key: 'result',
        width: 110,
        render: (v: RepoWebhookDeliveryResult) => resultTag(t, v)
      },
      {
        title: t('repos.webhookDeliveries.column.status'),
        dataIndex: 'httpStatus',
        key: 'httpStatus',
        width: 90,
        render: (v: number) => <Typography.Text>{v}</Typography.Text>
      },
      {
        title: t('repos.webhookDeliveries.column.message'),
        key: 'message',
        render: (_: any, row: RepoWebhookDeliverySummary) => {
          const parts = [row.code, row.message].filter(Boolean).join(' · ');
          return parts ? (
            <Typography.Text type={row.result === 'error' ? 'danger' : undefined}>{parts}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          );
        }
      },
      {
        title: t('repos.webhookDeliveries.column.tasks'),
        key: 'tasks',
        width: 260,
        render: (_: any, row: RepoWebhookDeliverySummary) => {
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
              {row.taskIds.length > 5 ? <Typography.Text type="secondary">+{row.taskIds.length - 5}</Typography.Text> : null}
            </Space>
          );
        }
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 90,
        render: (_: any, row: RepoWebhookDeliverySummary) => (
          <Button type="link" size="small" onClick={() => openDetail(row.id)}>
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
        footer={
          <Button onClick={() => setDetailOpen(false)}>{t('common.close')}</Button>
        }
        width={900}
      >
        {detailLoading ? (
          <>
            {/* Show a detail-shaped skeleton instead of plain text while loading delivery detail. ro3ln7zex8d0wyynfj0m */}
            <Skeleton active title={false} paragraph={{ rows: 10, width: ['92%', '88%', '96%', '86%', '90%', '82%', '96%', '78%', '88%', '60%'] }} />
          </>
        ) : detail ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={12} wrap>
              <Typography.Text code>{detail.createdAt}</Typography.Text>
              {resultTag(t, detail.result)}
              <Typography.Text type="secondary">
                {detail.provider === 'github' ? 'GitHub' : 'GitLab'} {detail.eventName ? `· ${detail.eventName}` : ''}
              </Typography.Text>
              <Typography.Text type="secondary">HTTP {detail.httpStatus}</Typography.Text>
            </Space>

            <Typography.Paragraph style={{ marginBottom: 0 }}>
              <Typography.Text strong>{t('repos.webhookDeliveries.detailMessage')}：</Typography.Text>{' '}
              {detail.code || detail.message ? (
                <Typography.Text type={detail.result === 'error' ? 'danger' : undefined}>
                  {[detail.code, detail.message].filter(Boolean).join(' · ')}
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              )}
            </Typography.Paragraph>

            <Typography.Paragraph style={{ marginBottom: 0 }}>
              <Typography.Text strong>{t('repos.webhookDeliveries.detailTasks')}：</Typography.Text>{' '}
              {detail.taskIds?.length ? (
                <Space size={6} wrap>
                  {detail.taskIds.map((id) => (
                    <Button key={id} type="link" size="small" style={{ padding: 0 }} onClick={() => (window.location.hash = `#/tasks/${id}`)}>
                      {id}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              )}
            </Typography.Paragraph>

            <div style={{ border: '1px solid rgba(5,5,5,0.06)', borderRadius: 6, padding: 12 }}>
              <Typography.Text strong>{t('repos.webhookDeliveries.detailPayload')}</Typography.Text>
              {/* Use the shared JSON viewer to render webhook payloads consistently. docs/en/developer/plans/payloadjsonui20260128/task_plan.md payloadjsonui20260128 */}
              <div style={{ marginTop: 8 }}>
                <JsonViewer value={detail.payload} />
              </div>
            </div>

            <div style={{ border: '1px solid rgba(5,5,5,0.06)', borderRadius: 6, padding: 12 }}>
              <Typography.Text strong>{t('repos.webhookDeliveries.detailResponse')}</Typography.Text>
              {/* Use the shared JSON viewer to render webhook responses consistently. docs/en/developer/plans/payloadjsonui20260128/task_plan.md payloadjsonui20260128 */}
              <div style={{ marginTop: 8 }}>
                <JsonViewer value={detail.response} />
              </div>
            </div>
          </Space>
        ) : (
          <Typography.Text type="secondary">{t('repos.webhookDeliveries.detailLoadFailed')}</Typography.Text>
        )}
      </Modal>
    </>
  );
};
