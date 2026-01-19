import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Button, Card, Empty, Input, Space, Tooltip, Typography } from 'antd';
import { PlayCircleOutlined, SearchOutlined } from '@ant-design/icons';
import type { Task, TaskStatus } from '../api';
import { fetchTasks, retryTask } from '../api';
import { useLocale, useT } from '../i18n';
import { buildTaskHash } from '../router';
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  const statusFilter = useMemo(() => normalizeStatusFilter(status), [status]);
  const repoIdFilter = useMemo(() => {
    // Keep the Tasks page compatible with both global and repo-scoped entry points. aw85xyfsp5zfg6ihq3jr
    const trimmed = String(repoId ?? '').trim();
    return trimmed || undefined;
  }, [repoId]);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return (
    <div className="hc-page">
      <PageNav
        title={t('tasks.page.title')}
        meta={<Typography.Text type="secondary">{t('tasks.page.subtitle', { count: filtered.length })}</Typography.Text>}
        userPanel={userPanel}
      />

      <div className="hc-page__body">
        <div className="hc-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('tasks.page.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length ? (
          <div className="hc-card-list">
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              {filtered.map((task) => (
                <Card
                  key={task.id}
                  size="small"
                  hoverable
                  className="hc-task-card"
                  styles={{ body: { padding: 12 } }}
                  onClick={() => openTask(task)}
                >
                  <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                    <Space size={10} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text strong style={{ minWidth: 0 }}>
                        {clampText(getTaskTitle(task), 80)}
                      </Typography.Text>
                      <Space size={6} wrap>
                        {statusTag(t, task.status)}
                        {task.status === 'queued' && task.permissions?.canManage ? (
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
                        ) : null}
                      </Space>
                    </Space>
                    <Space size={12} wrap>
                      <Typography.Text type="secondary">{task.repo?.name ?? task.repoId ?? '-'}</Typography.Text>
                      <Typography.Text type="secondary">{formatTime(task.updatedAt)}</Typography.Text>
                      <Typography.Text type="secondary">{task.id}</Typography.Text>
                    </Space>
                    {task.status === 'queued' ? (
                      /* Show a short queued diagnosis hint under queued tasks (best-effort). f3a9c2d8e1b7f4a0c6d1 */
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {queuedHintText(t, task)}
                      </Typography.Text>
                    ) : null}
                  </Space>
                </Card>
              ))}
            </Space>
          </div>
        ) : loading ? (
          // Use skeleton cards instead of an Empty+icon while the task list is loading. ro3ln7zex8d0wyynfj0m
          <CardListSkeleton
            count={6}
            cardClassName="hc-task-card"
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
