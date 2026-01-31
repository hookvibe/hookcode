import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Button, Card, Empty, Input, Popconfirm, Space, Tabs, Tag, Typography } from 'antd';
import { FolderOpenOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Repository, Task } from '../api';
import { fetchTasks, listRepos, unarchiveRepo } from '../api';
import { useLocale, useT } from '../i18n';
import { buildArchiveHash, buildRepoHash, buildTaskHash } from '../router';
import { PageNav } from '../components/nav/PageNav';
import { CardListSkeleton } from '../components/skeletons/CardListSkeleton';
import { clampText, getTaskTitle, statusTag } from '../utils/task';

/**
 * ArchivePage:
 * - Business context: provide a dedicated console area for archived repositories and tasks.
 * - Navigation: accessed via the bottom sidebar icon and supports hash `#/archive?tab=...`. qnp1mtxhzikhbi0xspbc
 */
export interface ArchivePageProps {
  tab?: string;
  userPanel?: ReactNode;
}

type ArchiveTabKey = 'repos' | 'tasks';

const normalizeTab = (value: string | undefined): ArchiveTabKey => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'tasks') return 'tasks';
  return 'repos';
};

export const ArchivePage: FC<ArchivePageProps> = ({ tab, userPanel }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const activeTab = useMemo(() => normalizeTab(tab), [tab]);

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

  const [reposLoading, setReposLoading] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [reposSearch, setReposSearch] = useState('');
  const [restoringRepoId, setRestoringRepoId] = useState<string | null>(null);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksSearch, setTasksSearch] = useState('');

  const refreshRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const data = await listRepos({ archived: 'archived' });
      setRepos(data);
    } catch (err) {
      console.error(err);
      message.error(t('toast.repos.fetchFailed'));
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, [message, t]);

  const refreshTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await fetchTasks({
        limit: 50,
        archived: 'archived',
        // Skip queue diagnosis for archived task lists to keep archive loads fast. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
        includeQueue: false
      });
      setTasks(data);
    } catch (err) {
      console.error(err);
      message.error(t('toast.tasks.fetchFailed'));
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void refreshRepos();
    void refreshTasks();
  }, [refreshRepos, refreshTasks]);

  const filteredRepos = useMemo(() => {
    const q = reposSearch.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => `${r.name} ${r.id} ${r.provider}`.toLowerCase().includes(q));
  }, [repos, reposSearch]);

  const filteredTasks = useMemo(() => {
    const q = tasksSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) => {
      const title = getTaskTitle(task);
      const repoName = task.repo?.name ?? task.repoId ?? '';
      return `${title} ${repoName} ${task.id}`.toLowerCase().includes(q);
    });
  }, [tasks, tasksSearch]);

  const restoreRepo = useCallback(
    async (repoId: string) => {
      if (!repoId) return;
      setRestoringRepoId(repoId);
      try {
        await unarchiveRepo(repoId);
        message.success(t('toast.repos.unarchiveSuccess'));
        await Promise.all([refreshRepos(), refreshTasks()]);
      } catch (err) {
        console.error(err);
        message.error(t('toast.repos.unarchiveFailed'));
      } finally {
        setRestoringRepoId((prev) => (prev === repoId ? null : prev));
      }
    },
    [message, refreshRepos, refreshTasks, t]
  );

  const openRepo = useCallback((repo: Repository) => {
    window.location.hash = buildRepoHash(repo.id);
  }, []);

  const openTask = useCallback((task: Task) => {
    window.location.hash = buildTaskHash(task.id);
  }, []);

  const onTabChange = useCallback((key: string) => {
    const next = normalizeTab(key);
    window.location.hash = buildArchiveHash({ tab: next });
  }, []);

  return (
    <div className="hc-page">
      <PageNav
        title={t('archive.page.title')}
        meta={<Typography.Text type="secondary">{t('archive.page.subtitle')}</Typography.Text>}
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void Promise.all([refreshRepos(), refreshTasks()])} loading={reposLoading || tasksLoading}>
            {t('common.refresh')}
          </Button>
        }
        userPanel={userPanel}
      />

      <div className="hc-page__body">
        <Tabs
          activeKey={activeTab}
          onChange={onTabChange}
          items={[
            {
              key: 'repos',
              label: t('archive.tabs.repos'),
              children: (
                <>
                  <div className="hc-toolbar">
                    <Input
                      allowClear
                      placeholder={t('archive.repos.searchPlaceholder')}
                      value={reposSearch}
                      onChange={(e) => setReposSearch(e.target.value)}
                    />
                  </div>

                  {filteredRepos.length ? (
                    <div className="hc-card-list">
                      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                        {filteredRepos.map((repo) => (
                          <Card
                            key={repo.id}
                            size="small"
                            hoverable
                            className="hc-repo-card"
                            styles={{ body: { padding: 12 } }}
                            onClick={() => openRepo(repo)}
                          >
                            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                              <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                <Typography.Text strong style={{ minWidth: 0 }}>
                                  {repo.name || repo.id}
                                </Typography.Text>
                                <Space size={6} wrap>
                                  <Tag color={repo.provider === 'github' ? 'geekblue' : 'orange'}>
                                    {repo.provider === 'github' ? 'GitHub' : 'GitLab'}
                                  </Tag>
                                  {/* Replace `enabled` with an explicit archived badge to avoid confusing status in Archive. qnp1mtxhzikhbi0xspbc */}
                                  <Tag icon={<LockOutlined />} color="default">
                                    {t('archive.repos.archived')}
                                  </Tag>
                                </Space>
                              </Space>

                              <Space size={10} wrap>
                                <Typography.Text type="secondary">{repo.id}</Typography.Text>
                                {/* Show archived timestamp as meta text to keep the card header compact. qnp1mtxhzikhbi0xspbc */}
                                <Typography.Text type="secondary">
                                  {repo.archivedAt ? t('archive.repos.archivedAt', { time: formatTime(repo.archivedAt) }) : t('archive.repos.archived')}
                                </Typography.Text>
                              </Space>

                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <Button
                                  size="small"
                                  icon={<FolderOpenOutlined />}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openRepo(repo);
                                  }}
                                >
                                  {/* Use "View" wording inside Archive since archived repos are read-only. qnp1mtxhzikhbi0xspbc */}
                                  {t('common.view')}
                                </Button>
                                <Popconfirm
                                  title={t('archive.repos.restoreConfirm.title')}
                                  description={t('archive.repos.restoreConfirm.desc')}
                                  okText={t('common.restore')}
                                  cancelText={t('common.cancel')}
                                  onConfirm={() => void restoreRepo(repo.id)}
                                >
                                  <Button
                                    size="small"
                                    type="primary"
                                    loading={restoringRepoId === repo.id}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    {t('common.restore')}
                                  </Button>
                                </Popconfirm>
                              </div>
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    </div>
                  ) : reposLoading ? (
                    <CardListSkeleton count={6} cardClassName="hc-repo-card" testId="hc-archive-repos-skeleton" ariaLabel={t('common.loading')} />
                  ) : (
                    <div className="hc-empty">
                      <Empty description={t('archive.repos.empty')} />
                    </div>
                  )}
                </>
              )
            },
            {
              key: 'tasks',
              label: t('archive.tabs.tasks'),
              children: (
                <>
                  <div className="hc-toolbar">
                    <Input
                      allowClear
                      placeholder={t('archive.tasks.searchPlaceholder')}
                      value={tasksSearch}
                      onChange={(e) => setTasksSearch(e.target.value)}
                    />
                  </div>

                  {filteredTasks.length ? (
                    <div className="hc-card-list">
                      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                        {filteredTasks.map((task) => (
                          <Card
                            key={task.id}
                            size="small"
                            hoverable
                            className="hc-task-card"
                            styles={{ body: { padding: 12 } }}
                            onClick={() => openTask(task)}
                          >
                            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                              <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                <Typography.Text strong style={{ minWidth: 0 }}>
                                  {clampText(getTaskTitle(task), 80)}
                                </Typography.Text>
                                {/* Reuse shared statusTag helper (signature: (t, status)) for consistent UI. qnp1mtxhzikhbi0xspbc */}
                                {statusTag(t, task.status)}
                              </Space>
                              <Space size={10} wrap>
                                <Typography.Text type="secondary">{task.repo?.name ?? task.repoId ?? '-'}</Typography.Text>
                                <Typography.Text type="secondary">{formatTime(task.updatedAt)}</Typography.Text>
                                {task.archivedAt ? (
                                  <Tag color="default">{t('archive.tasks.archivedAt', { time: formatTime(task.archivedAt) })}</Tag>
                                ) : null}
                              </Space>
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    </div>
                  ) : tasksLoading ? (
                    <CardListSkeleton count={6} cardClassName="hc-task-card" testId="hc-archive-tasks-skeleton" ariaLabel={t('common.loading')} />
                  ) : (
                    <div className="hc-empty">
                      <Empty description={t('archive.tasks.empty')} />
                    </div>
                  )}
                </>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};
