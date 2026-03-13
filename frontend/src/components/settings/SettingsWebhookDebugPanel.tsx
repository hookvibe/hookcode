import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Card, Empty, Input, Modal, Select, Skeleton, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  fetchWebhookEvent,
  getApiErrorMessage,
  listWebhookEvents,
  replayWebhookEvent,
  replayWebhookEventDryRun,
  type ReplayWebhookEventRequest,
  type RepoProvider,
  type RepoWebhookDeliveryResult,
  type WebhookErrorLayer,
  type WebhookEventDetail,
  type WebhookEventSummary
} from '../../api';
import { buildRepoHash } from '../../router';
import { useT } from '../../i18n';
import { renderWebhookResultTag, WebhookEventDetailView } from '../webhooks/WebhookEventDetailView';

const PAGE_SIZE = 20;
const FETCH_LIMIT = 50;

type FilterState = {
  repoId: string;
  query: string;
  replayOfEventId: string;
  provider: 'all' | RepoProvider;
  result: 'all' | RepoWebhookDeliveryResult;
  errorLayer: 'all' | WebhookErrorLayer;
};

const EMPTY_FILTERS: FilterState = {
  repoId: '',
  query: '',
  replayOfEventId: '',
  provider: 'all',
  result: 'all',
  errorLayer: 'all'
};

// Render the admin-wide webhook replay/debug center with filters, failure summaries, and replay controls. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export const SettingsWebhookDebugPanel: FC = () => {
  const t = useT();
  const { message } = App.useApp();

  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [events, setEvents] = useState<WebhookEventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<WebhookEventDetail | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(1);
    try {
      const data = await listWebhookEvents({
        limit: FETCH_LIMIT,
        ...(filters.repoId ? { repoId: filters.repoId } : {}),
        ...(filters.query ? { q: filters.query } : {}),
        ...(filters.replayOfEventId ? { replayOfEventId: filters.replayOfEventId } : {}),
        ...(filters.provider !== 'all' ? { provider: filters.provider } : {}),
        ...(filters.result !== 'all' ? { result: filters.result } : {}),
        ...(filters.errorLayer !== 'all' ? { errorLayer: filters.errorLayer } : {})
      });
      setEvents(Array.isArray(data.events) ? data.events : []);
      setNextCursor(data.nextCursor);
    } catch (nextError) {
      setEvents([]);
      setNextCursor(undefined);
      setError(getApiErrorMessage(nextError) || t('panel.webhooks.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const ensurePageData = useCallback(
    async (targetPage: number) => {
      const safePage = Math.max(targetPage, 1);
      setPage(safePage);
      if (events.length >= safePage * PAGE_SIZE || !nextCursor) return;
      setLoadingMore(true);
      setError(null);
      try {
        let cursor: string | undefined = nextCursor;
        let nextEvents = events;
        const targetCount = safePage * PAGE_SIZE;
        while (cursor && nextEvents.length < targetCount) {
          const data = await listWebhookEvents({
            limit: FETCH_LIMIT,
            cursor,
            ...(filters.repoId ? { repoId: filters.repoId } : {}),
            ...(filters.query ? { q: filters.query } : {}),
            ...(filters.replayOfEventId ? { replayOfEventId: filters.replayOfEventId } : {}),
            ...(filters.provider !== 'all' ? { provider: filters.provider } : {}),
            ...(filters.result !== 'all' ? { result: filters.result } : {}),
            ...(filters.errorLayer !== 'all' ? { errorLayer: filters.errorLayer } : {})
          });
          const batch = Array.isArray(data.events) ? data.events : [];
          const existing = new Set(nextEvents.map((item) => item.id));
          nextEvents = [...nextEvents, ...batch.filter((item) => !existing.has(item.id))];
          cursor = data.nextCursor;
          if (!batch.length) break;
        }
        setEvents(nextEvents);
        setNextCursor(cursor);
      } catch (nextError) {
        setError(getApiErrorMessage(nextError) || t('panel.webhooks.error.loadFailed'));
      } finally {
        setLoadingMore(false);
      }
    },
    [events, filters, nextCursor, t]
  );

  const openDetail = useCallback(async (eventId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await fetchWebhookEvent(eventId);
      setDetail(data);
    } catch (nextError) {
      setDetail(null);
      message.error(getApiErrorMessage(nextError) || t('repos.webhookDeliveries.detailLoadFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [message, t]);

  const handleReplay = useCallback(async (input: ReplayWebhookEventRequest, options: { dryRun: boolean }) => {
    if (!detail) return;
    const setSubmitting = options.dryRun ? setDryRunLoading : setReplayLoading;
    setSubmitting(true);
    try {
      const next = options.dryRun
        ? await replayWebhookEventDryRun(detail.id, input)
        : await replayWebhookEvent(detail.id, input);
      setDetail(next);
      await loadEvents();
      message.success(t(options.dryRun ? 'repos.webhookDeliveries.replay.dryRunSuccess' : 'repos.webhookDeliveries.replay.success'));
    } catch (nextError) {
      message.error(getApiErrorMessage(nextError) || t(options.dryRun ? 'repos.webhookDeliveries.replay.dryRunFailed' : 'repos.webhookDeliveries.replay.failed'));
    } finally {
      setSubmitting(false);
    }
  }, [detail, loadEvents, message, t]);

  const pagedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [events, page]);

  const paginationTotal = useMemo(() => {
    if (nextCursor) return Math.max(events.length + PAGE_SIZE, page * PAGE_SIZE);
    return events.length;
  }, [events.length, nextCursor, page]);

  const stats = useMemo(() => {
    const failed = events.filter((event) => event.result === 'error' || event.result === 'rejected').length;
    const replays = events.filter((event) => Boolean(event.replayOfEventId)).length;
    const dryRuns = events.filter((event) => event.errorLayer === 'dry_run').length;
    const layerCounts = events.reduce<Record<string, number>>((acc, event) => {
      if (!event.errorLayer) return acc;
      acc[event.errorLayer] = (acc[event.errorLayer] ?? 0) + 1;
      return acc;
    }, {});
    const topLayers = Object.entries(layerCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);
    return { failed, replays, dryRuns, topLayers };
  }, [events]);

  const columns = useMemo<ColumnsType<WebhookEventSummary>>(
    () => [
      {
        title: t('panel.webhooks.column.repo'),
        dataIndex: 'repoId',
        key: 'repoId',
        width: 180,
        render: (value: string) => (
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => {
              if (typeof window !== 'undefined') window.location.hash = buildRepoHash(value, 'webhooks');
            }}
          >
            {value}
          </Button>
        )
      },
      {
        title: t('repos.webhookDeliveries.column.time'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>
      },
      {
        title: t('common.platform'),
        dataIndex: 'provider',
        key: 'provider',
        width: 96,
        render: (value: string) => <Typography.Text>{value === 'github' ? 'GitHub' : 'GitLab'}</Typography.Text>
      },
      {
        title: t('repos.webhookDeliveries.column.event'),
        key: 'eventName',
        render: (_, row) => (
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
        title: t('panel.webhooks.column.diagnosis'),
        key: 'diagnosis',
        render: (_, row) => (
          <Space wrap size={6}>
            {row.errorLayer ? <Tag color="red">{row.errorLayer}</Tag> : null}
            {row.replayMode ? <Tag color="blue">{t(`repos.webhookDeliveries.replay.mode.${row.replayMode}` as const)}</Tag> : null}
            {row.signatureVerified === false ? <Tag color="orange">{t('repos.webhookDeliveries.signature.failed')}</Tag> : null}
          </Space>
        )
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 90,
        render: (_, row) => (
          <Button type="link" size="small" onClick={() => void openDetail(row.id)}>
            {t('common.view')}
          </Button>
        )
      }
    ],
    [openDetail, t]
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Input
          value={draft.repoId}
          onChange={(event) => setDraft((prev) => ({ ...prev, repoId: event.target.value }))}
          placeholder={t('panel.webhooks.filters.repoId')}
          style={{ minWidth: 180 }}
        />
        <Input
          value={draft.replayOfEventId}
          onChange={(event) => setDraft((prev) => ({ ...prev, replayOfEventId: event.target.value }))}
          placeholder={t('panel.webhooks.filters.replayOfEventId')}
          style={{ minWidth: 220 }}
        />
        <Input.Search
          value={draft.query}
          onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))}
          onSearch={() =>
            setFilters({
              ...draft,
              repoId: draft.repoId.trim(),
              replayOfEventId: draft.replayOfEventId.trim(),
              query: draft.query.trim()
            })
          }
          placeholder={t('panel.webhooks.filters.query')}
          allowClear
          style={{ minWidth: 220 }}
        />
        <Select
          value={draft.provider}
          style={{ minWidth: 150 }}
          onChange={(value) => setDraft((prev) => ({ ...prev, provider: value }))}
          options={[
            { value: 'all', label: t('panel.webhooks.filters.allProviders') },
            { value: 'gitlab', label: 'GitLab' },
            { value: 'github', label: 'GitHub' }
          ]}
        />
        <Select
          value={draft.result}
          style={{ minWidth: 150 }}
          onChange={(value) => setDraft((prev) => ({ ...prev, result: value }))}
          options={[
            { value: 'all', label: t('panel.webhooks.filters.allResults') },
            { value: 'accepted', label: t('repos.webhookDeliveries.result.accepted') },
            { value: 'skipped', label: t('repos.webhookDeliveries.result.skipped') },
            { value: 'rejected', label: t('repos.webhookDeliveries.result.rejected') },
            { value: 'error', label: t('repos.webhookDeliveries.result.error') }
          ]}
        />
        <Select
          value={draft.errorLayer}
          style={{ minWidth: 180 }}
          onChange={(value) => setDraft((prev) => ({ ...prev, errorLayer: value }))}
          options={[
            { value: 'all', label: t('panel.webhooks.filters.allErrorLayers') },
            ...([
              'repo_lookup',
              'repo_state',
              'provider_mismatch',
              'scope_validation',
              'signature_validation',
              'name_binding',
              'repo_binding',
              'robot_resolution',
              'event_mapping',
              'guard',
              'rule_match',
              'task_creation',
              'dry_run',
              'replay',
              'internal'
            ] as WebhookErrorLayer[]).map((value) => ({ value, label: value }))
          ]}
        />
        <Button
          type="primary"
          onClick={() =>
            setFilters({
              ...draft,
              repoId: draft.repoId.trim(),
              replayOfEventId: draft.replayOfEventId.trim(),
              query: draft.query.trim()
            })
          }
        >
          {t('panel.webhooks.filters.apply')}
        </Button>
        <Button onClick={() => void loadEvents()} loading={loading}>
          {t('common.refresh')}
        </Button>
      </Space>

      <Space wrap style={{ width: '100%' }}>
        <Card size="small" title={t('panel.webhooks.summary.totalLoaded')} style={{ minWidth: 180 }}>
          <Typography.Text strong>{events.length}</Typography.Text>
        </Card>
        <Card size="small" title={t('panel.webhooks.summary.failed')} style={{ minWidth: 180 }}>
          <Typography.Text strong>{stats.failed}</Typography.Text>
        </Card>
        <Card size="small" title={t('panel.webhooks.summary.replays')} style={{ minWidth: 180 }}>
          <Typography.Text strong>{stats.replays}</Typography.Text>
        </Card>
        <Card size="small" title={t('panel.webhooks.summary.dryRuns')} style={{ minWidth: 180 }}>
          <Typography.Text strong>{stats.dryRuns}</Typography.Text>
        </Card>
        <Card size="small" title={t('panel.webhooks.summary.topErrors')} style={{ flex: 1, minWidth: 240 }}>
          {stats.topLayers.length ? (
            <Space wrap>
              {stats.topLayers.map(([layer, count]) => (
                <Tag key={layer} color="red">
                  {layer} · {count}
                </Tag>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">{t('panel.webhooks.summary.none')}</Typography.Text>
          )}
        </Card>
      </Space>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      {loading && !events.length ? (
        <Skeleton active title={false} paragraph={{ rows: 8 }} />
      ) : (
        <Table
          rowKey={(record) => record.id}
          columns={columns}
          dataSource={pagedEvents}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: paginationTotal,
            showSizeChanger: false,
            onChange: (nextPage) => void ensurePageData(nextPage)
          }}
          loading={loadingMore}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('panel.webhooks.empty')} />
          }}
          size="small"
        />
      )}

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
            canReplay
            replayLoading={replayLoading}
            dryRunLoading={dryRunLoading}
            onReplay={handleReplay}
            onOpenEvent={(eventId) => void openDetail(eventId)}
          />
        ) : (
          <Typography.Text type="secondary">{t('repos.webhookDeliveries.detailLoadFailed')}</Typography.Text>
        )}
      </Modal>
    </Space>
  );
};
