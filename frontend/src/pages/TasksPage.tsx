import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Button, Card, Empty, Input, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { PlayCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { Task, TaskStatus, TaskStatusStats } from '../api';
import { executeTaskNow, fetchTaskStats, fetchTasks, retryTask } from '../api';
import { useLocale, useT } from '../i18n';
import { buildTaskHash, buildTasksHash } from '../router';
import { clampText, getTaskTitle, queuedHintText, statusTag } from '../utils/task';
import { PageNav } from '../components/nav/PageNav';
import { CardListSkeleton } from '../components/skeletons/CardListSkeleton';

/**
 * TasksPage:
 * - Business context: list tasks for quick navigation from the Home sidebar.
 * - Scope (migration step 1): support status filter via hash query (`#/tasks?status=...`) and navigation to task detail.
 * - Extension: support repo-scoped lists via `#/tasks?repoId=...` for deep-links from repo dashboards. aw85xyfsp5zfg6ihq3jr
 *
 * Change record:
 * - 2026-01-11: Added for `frontend-chat` to replace legacy task list navigation.
 * - 2026-01-11: Replace deprecated AntD `List` with a card list to avoid runtime warnings and match the chat-first visual style.
 */

export interface TasksPageProps {
  status?: string;
  repoId?: string;
  userPanel?: ReactNode;
}

type StatusFilter = 'all' | TaskStatus | 'success';
type StatusSummaryKey = 'all' | 'queued' | 'processing' | 'success' | 'failed';

const normalizeStatusFilter = (value: string | undefined): StatusFilter => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === 'all') return 'all';
  if (raw === 'success') return 'success';
  if (raw === 'queued' || raw === 'processing' || raw === 'succeeded' || raw === 'failed' || raw === 'commented')
    return raw;
  // Compatibility: allow Home sidebar status keys.
  if (raw === 'completed') return 'success';
  return 'all';
};

export const TasksPage: FC<TasksPageProps> = ({ status, repoId, userPanel }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStatusStats | null>(null);
  const [search, setSearch] = useState('');
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  const statusFilter = useMemo(() => normalizeStatusFilter(status), [status]);
  const repoIdFilter = useMemo(() => {
    // Keep the Tasks page compatible with both global and repo-scoped entry points. aw85xyfsp5zfg6ihq3jr
    const trimmed = String(repoId ?? '').trim();
    return trimmed || undefined;
  }, [repoId]);

  const statusSummaryKey = useMemo<StatusSummaryKey>(() => {
    // Group terminal success-like statuses under `success` for summary/UI selection. 3iz4jx8bsy7q7d6b3jr3
    if (statusFilter === 'queued') return 'queued';
    if (statusFilter === 'processing') return 'processing';
    if (statusFilter === 'failed') return 'failed';
    if (statusFilter === 'all') return 'all';
    return 'success';
  }, [statusFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params: { limit: number; status?: StatusFilter; repoId?: string } = {
        limit: 50,
        status: statusFilter === 'all' ? undefined : statusFilter
      };
      if (repoIdFilter) params.repoId = repoIdFilter;
      const list = await fetchTasks(params);
      setTasks(list);
    } catch (err) {
      console.error(err);
      message.error(t('toast.tasks.fetchFailed'));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [message, repoIdFilter, statusFilter, t]);

  const refreshStats = useCallback(async () => {
    // Load status totals for the summary strip so users can see the current filter at a glance. 3iz4jx8bsy7q7d6b3jr3
    setStatsLoading(true);
    try {
      const next = await fetchTaskStats(repoIdFilter ? { repoId: repoIdFilter } : undefined);
      setStats(next);
    } catch (err) {
      console.error(err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [repoIdFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) => {
      const title = getTaskTitle(task);
      const repoName = task.repo?.name ?? task.repoId ?? '';
      return `${title} ${repoName} ${task.id}`.toLowerCase().includes(q);
    });
  }, [search, tasks]);

  const openTask = useCallback((task: Task) => {
    window.location.hash = buildTaskHash(task.id);
  }, []);

  const setStatusFilterInHash = useCallback(
    (next: StatusSummaryKey) => {
      // Keep filter state shareable by encoding it in the hash query (`#/tasks?status=...`). 3iz4jx8bsy7q7d6b3jr3
      const nextStatus = next === 'all' ? '' : next;
      window.location.hash = buildTasksHash({ status: nextStatus, repoId: repoIdFilter });
    },
    [repoIdFilter]
  );

  const clearRepoScopeInHash = useCallback(() => {
    // Allow leaving a repo-scoped list while preserving the current status filter. 3iz4jx8bsy7q7d6b3jr3
    const nextStatus = statusFilter === 'all' ? '' : String(statusFilter);
    window.location.hash = buildTasksHash({ status: nextStatus });
  }, [statusFilter]);

  const handleRetry = useCallback(
    async (task: Task) => {
      // Allow retrying queued tasks directly from the task list top-right action. f3a9c2d8e1b7f4a0c6d1
      if (!task?.id) return;
      if (!task.permissions?.canManage) {
        message.warning(t('tasks.empty.noPermission'));
        return;
      }
      setRetryingTaskId(task.id);
      try {
        await retryTask(task.id);
        message.success(t('toast.task.retrySuccess'));
        await refresh();
      } catch (err) {
        console.error(err);
        message.error(t('toast.task.retryFailedTasksFailed'));
      } finally {
        setRetryingTaskId((prev) => (prev === task.id ? null : prev));
      }
    },
    [message, refresh, t]
  );

  const handleExecuteNow = useCallback(
    async (task: Task) => {
      // Allow manual execution when tasks are blocked by time windows. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      if (!task?.id) return;
      if (!task.permissions?.canManage) {
        message.warning(t('tasks.empty.noPermission'));
        return;
      }
      setRetryingTaskId(task.id);
      try {
        await executeTaskNow(task.id);
        message.success(t('toast.task.executeNowSuccess'));
        await refresh();
      } catch (err) {
        console.error(err);
        message.error(t('toast.task.executeNowFailed'));
      } finally {
        setRetryingTaskId((prev) => (prev === task.id ? null : prev));
      }
    },
    [message, refresh, t]
  );

  const refreshAll = useCallback(async () => {
    // Refresh both list and stats to keep the summary strip consistent with the loaded tasks. 3iz4jx8bsy7q7d6b3jr3
    await Promise.all([refresh(), refreshStats()]);
  }, [refresh, refreshStats]);

  const formatTime = useCallback(
    (iso: string): string => {
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
      } catch {
        return iso;
      }
    },
    [locale]
  );

  const activeStatusText = useMemo(() => {
    // Provide a single user-visible status label for the active filter (including the virtual `success`). 3iz4jx8bsy7q7d6b3jr3
    if (statusFilter === 'all') return t('tasks.filter.all');
    if (statusFilter === 'success') return t('tasks.filter.success');
    if (statusFilter === 'queued') return t('task.status.queued');
    if (statusFilter === 'processing') return t('task.status.processing');
    if (statusFilter === 'succeeded') return t('task.status.succeeded');
    if (statusFilter === 'failed') return t('task.status.failed');
    if (statusFilter === 'commented') return t('task.status.commented');
    return String(statusFilter);
  }, [statusFilter, t]);

  const activeStatusTagColor = useMemo(() => {
    // Align filter tag colors with `statusTag()` so the UI stays consistent across task views. 3iz4jx8bsy7q7d6b3jr3
    if (statusFilter === 'queued') return 'blue';
    if (statusFilter === 'processing') return 'gold';
    if (statusFilter === 'failed') return 'red';
    if (statusFilter === 'commented') return 'purple';
    if (statusFilter === 'succeeded' || statusFilter === 'success') return 'green';
    return undefined;
  }, [statusFilter]);

  const statusStripItems = useMemo(() => {
    const base: Array<{ key: StatusSummaryKey; label: string; count?: number }> = [
      { key: 'all', label: t('tasks.filter.all'), count: stats?.total ?? undefined },
      { key: 'queued', label: t('task.status.queued'), count: stats?.queued ?? undefined },
      { key: 'processing', label: t('task.status.processing'), count: stats?.processing ?? undefined },
      { key: 'success', label: t('tasks.filter.success'), count: stats?.success ?? undefined },
      { key: 'failed', label: t('task.status.failed'), count: stats?.failed ?? undefined }
    ];
    return base;
  }, [stats, t]);

  return (
    <div className="hc-page">
      <PageNav
        title={t('tasks.page.title')}
        meta={
          <Space size={8}>
            {/* Surface the active filter state in the header so deep-linked URLs are self-explanatory. 3iz4jx8bsy7q7d6b3jr3 */}
            <Tag color={activeStatusTagColor}>{t('tasks.page.filter.statusTag', { status: activeStatusText })}</Tag>
            {repoIdFilter ? (
              <Tooltip title={repoIdFilter}>
                <Tag>{t('tasks.page.filter.repoTag', { repo: clampText(repoIdFilter, 18) })}</Tag>
              </Tooltip>
            ) : null}
            <Typography.Text type="secondary">{t('tasks.page.subtitle', { count: filtered.length })}</Typography.Text>
          </Space>
        }
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()} loading={loading || statsLoading}>
            {t('common.refresh')}
          </Button>
        }
        userPanel={userPanel}
      />

      <div className="hc-page__body">
        <div className="hc-tasks-controls">
          <div className="hc-tasks-status-strip" role="group" aria-label={t('common.status')}>
            {statsLoading && !stats
              ? // Use skeleton blocks to prevent layout jump while loading status totals. ro3ln7zex8d0wyynfj0m
                statusStripItems.map((item) => (
                  <Skeleton.Button key={item.key} active block className="hc-tasks-status-tile hc-tasks-status-tile--skeleton" />
                ))
              : statusStripItems.map((item) => {
                  const active = statusSummaryKey === item.key;
                  const countText = typeof item.count === 'number' ? String(item.count) : stats ? '0' : '—';
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`hc-tasks-status-tile${active ? ' hc-tasks-status-tile--active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setStatusFilterInHash(item.key)}
                      title={`${item.label} ${countText}`}
                    >
                      <span className="hc-tasks-status-tile__label">{item.label}</span>
                      <span className="hc-tasks-status-tile__value">{countText}</span>
                    </button>
                  );
                })}
          </div>

          <div className="hc-tasks-filters">
            {/* Repeat active filters inside the scrollable body because header meta is hidden on mobile. 3iz4jx8bsy7q7d6b3jr3 */}
            <Tag color={activeStatusTagColor}>{t('tasks.page.filter.statusTag', { status: activeStatusText })}</Tag>
            {repoIdFilter ? (
              <Tooltip title={repoIdFilter}>
                <Tag
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    clearRepoScopeInHash();
                  }}
                >
                  {t('tasks.page.filter.repoTag', { repo: clampText(repoIdFilter, 26) })}
                </Tag>
              </Tooltip>
            ) : null}
          </div>

          {/* Layout: keep the search input on its own full-width row for faster scanning. 3iz4jx8bsy7q7d6b3jr3 */}
          <div className="hc-tasks-search">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={t('tasks.page.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length ? (
          <div className="hc-card-list">
            {/* Switch task list to a responsive grid with segmented card sections. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
            <div className="hc-card-grid">
              {filtered.map((task) => (
                <Card
                  key={task.id}
                  size="small"
                  hoverable
                  className="hc-task-card"
                  // Refresh task card padding to match the modernized glass layout. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
                  styles={{ body: { padding: 14 } }}
                  onClick={() => openTask(task)}
                >
                  {/* Segment task card content into clear blocks for the grid layout. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
                  <div className="hc-card-structure">
                    <div className="hc-card-header">
                      <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text strong style={{ minWidth: 0 }}>
                          {clampText(getTaskTitle(task), 80)}
                        </Typography.Text>
                        <Space size={6} wrap>
                          {statusTag(t, task.status)}
                          {task.status === 'queued' && task.permissions?.canManage ? (
                            task.queue?.reasonCode === 'outside_time_window' ? (
                              <Tooltip title={t('tasks.executeNow')}>
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<PlayCircleOutlined />}
                                  aria-label={t('tasks.executeNow')}
                                  loading={retryingTaskId === task.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleExecuteNow(task);
                                  }}
                                />
                              </Tooltip>
                            ) : (
                              /* Render a retry affordance beside the queued status tag. f3a9c2d8e1b7f4a0c6d1 */
                              <Tooltip title={t('tasks.retry')}>
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<PlayCircleOutlined />}
                                  aria-label={t('tasks.retry')}
                                  loading={retryingTaskId === task.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleRetry(task);
                                  }}
                                />
                              </Tooltip>
                            )
                          ) : null}
                        </Space>
                      </Space>
                    </div>

                    <div className="hc-card-divider" />

                    {/* Group task meta details for shared card styling. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
                    <Space size={12} wrap className="hc-card-meta">
                      <Typography.Text type="secondary">{task.repo?.name ?? task.repoId ?? '-'}</Typography.Text>
                      <Typography.Text type="secondary">{formatTime(task.updatedAt)}</Typography.Text>
                      <Typography.Text type="secondary">{task.id}</Typography.Text>
                    </Space>

                    {task.status === 'queued' ? (
                      <>
                        <div className="hc-card-divider" />
                        {/* Show a short queued diagnosis hint under queued tasks (best-effort). f3a9c2d8e1b7f4a0c6d1 */}
                        <Typography.Text type="secondary" className="hc-card-note">
                          {queuedHintText(t, task)}
                        </Typography.Text>
                      </>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : loading ? (
          // Use skeleton cards instead of an Empty+icon while the task list is loading. ro3ln7zex8d0wyynfj0m
          <CardListSkeleton
            count={6}
            cardClassName="hc-task-card"
            layout="grid"
            testId="hc-tasks-skeleton"
            ariaLabel={t('common.loading')}
          />
        ) : (
          <div className="hc-empty">
            <Empty description={loading ? t('common.loading') : t('tasks.page.empty')} />
          </div>
        )}
      </div>
    </div>
  );
};
