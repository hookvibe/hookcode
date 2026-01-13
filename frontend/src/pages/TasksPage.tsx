import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Card, Empty, Input, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { Task, TaskStatus } from '../api';
import { fetchTasks } from '../api';
import { useLocale, useT } from '../i18n';
import { buildTaskHash } from '../router';
import { clampText, getTaskTitle, statusTag } from '../utils/task';
import { PageNav } from '../components/nav/PageNav';

/**
 * TasksPage:
 * - Business context: list tasks for quick navigation from the Home sidebar.
 * - Scope (migration step 1): support status filter via hash query (`#/tasks?status=...`) and navigation to task detail.
 *
 * Change record:
 * - 2026-01-11: Added for `frontend-chat` to replace legacy task list navigation.
 * - 2026-01-11: Replace deprecated AntD `List` with a card list to avoid runtime warnings and match the chat-first visual style.
 */

export interface TasksPageProps {
  status?: string;
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

export const TasksPage: FC<TasksPageProps> = ({ status, userPanel }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');

  const statusFilter = useMemo(() => normalizeStatusFilter(status), [status]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchTasks({
        limit: 50,
        status: statusFilter === 'all' ? undefined : statusFilter
      });
      setTasks(list);
    } catch (err) {
      console.error(err);
      message.error(t('toast.tasks.fetchFailed'));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [message, statusFilter, t]);

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
                      {statusTag(t, task.status)}
                    </Space>
                    <Space size={12} wrap>
                      <Typography.Text type="secondary">{task.repo?.name ?? task.repoId ?? '-'}</Typography.Text>
                      <Typography.Text type="secondary">{formatTime(task.updatedAt)}</Typography.Text>
                      <Typography.Text type="secondary">{task.id}</Typography.Text>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </div>
        ) : (
          <div className="hc-empty">
            <Empty description={loading ? t('common.loading') : t('tasks.page.empty')} />
          </div>
        )}
      </div>
    </div>
  );
};
