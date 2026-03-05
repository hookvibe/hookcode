// Update imports after per-page nested folder migration. docs/en/developer/plans/frontend-page-folder-refactor-20260305/task_plan.md frontend-page-folder-refactor-20260305
import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App, Button, Card, Empty, Input, Popconfirm, Space, Tag, Typography } from 'antd';
import { FolderOpenOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Repository, Task } from '../../api';
import { fetchTasks, listRepos, unarchiveRepo } from '../../api';
import { useLocale, useT } from '../../i18n';
import { buildArchiveHash, buildRepoHash, buildTaskHash } from '../../router';
import type { ArchiveTab } from '../../router';
import { PageNav, type PageNavMenuAction } from '../../components/nav/PageNav';
import { CardListSkeleton } from '../../components/skeletons/CardListSkeleton';
import { clampText, getTaskTitle, statusTag } from '../../utils/task';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { ArchiveSidebar } from '../../components/archive/ArchiveSidebar';

/**
 * ArchivePage:
 * - Business context: provide a dedicated console area for archived repositories and tasks.
 * - Navigation: sidebar sub-navigation layout matching RepoDetailPage pattern.
 *
 * Change record:
 * - 2026-03-01: Refactored from AntD Tabs to sidebar sub-navigation layout.
 *
 * Archive page with sidebar sub-navigation layout. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
 */
export interface ArchivePageProps {
  // Active sub-tab from the route (repos or tasks). docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  archiveTab?: ArchiveTab;
  userPanel?: ReactNode;
  navToggle?: PageNavMenuAction;
}

type ArchiveTabKey = 'repos' | 'tasks';

const ARCHIVE_REPOS_PAGE_SIZE = 30; // Keep archive repo pagination consistent with list pages. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
const ARCHIVE_TASKS_PAGE_SIZE = 30; // Keep archive task pagination consistent with list pages. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b

const normalizeTab = (value: string | undefined): ArchiveTabKey => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'tasks') return 'tasks';
  return 'repos';
};

export const ArchivePage: FC<ArchivePageProps> = ({ archiveTab, userPanel, navToggle }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const reposLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const tasksLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const activeTab = useMemo(() => normalizeTab(archiveTab), [archiveTab]);

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
  const [reposLoadingMore, setReposLoadingMore] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [reposNextCursor, setReposNextCursor] = useState<string | null>(null); // Track cursor for archive repo pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const [reposSearch, setReposSearch] = useState('');
  const [restoringRepoId, setRestoringRepoId] = useState<string | null>(null);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksLoadingMore, setTasksLoadingMore] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksNextCursor, setTasksNextCursor] = useState<string | null>(null); // Track cursor for archive task pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const [tasksSearch, setTasksSearch] = useState('');

  const fetchReposPage = useCallback(
    async ({ append, cursor }: { append: boolean; cursor?: string }) => {
      // Fetch a single paginated archive repo page for infinite scroll. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
      const setBusy = append ? setReposLoadingMore : setReposLoading;
      setBusy(true);
      try {
        const { repos: data, nextCursor } = await listRepos({
          archived: 'archived',
          limit: ARCHIVE_REPOS_PAGE_SIZE,
          cursor
        });
        setRepos((prev) => {
          if (!append) return data;
          const existing = new Set(prev.map((repo) => repo.id));
          return [...prev, ...data.filter((repo) => !existing.has(repo.id))];
        });
        setReposNextCursor(nextCursor ?? null);
      } catch (err) {
        console.error(err);
        if (!append) {
          message.error(t('toast.repos.fetchFailed'));
          setRepos([]);
        }
      } finally {
        setBusy(false);
      }
    },
    [message, t]
  );

  const fetchTasksPage = useCallback(
    async ({ append, cursor }: { append: boolean; cursor?: string }) => {
      // Fetch a single paginated archive task page for infinite scroll. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
      const setBusy = append ? setTasksLoadingMore : setTasksLoading;
      setBusy(true);
      try {
        const { tasks: data, nextCursor } = await fetchTasks({
          limit: ARCHIVE_TASKS_PAGE_SIZE,
          cursor,
          archived: 'archived',
          // Skip queue diagnosis for archived task lists to keep archive loads fast. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
          includeQueue: false
        });
        setTasks((prev) => {
          if (!append) return data;
          const existing = new Set(prev.map((task) => task.id));
          return [...prev, ...data.filter((task) => !existing.has(task.id))];
        });
        setTasksNextCursor(nextCursor ?? null);
      } catch (err) {
        console.error(err);
        if (!append) {
          message.error(t('toast.tasks.fetchFailed'));
          setTasks([]);
        }
      } finally {
        setBusy(false);
      }
    },
    [message, t]
  );

  const refreshRepos = useCallback(async () => {
    // Reset archived repo pagination when users refresh the Archive tab. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    await fetchReposPage({ append: false });
  }, [fetchReposPage]);

  const refreshTasks = useCallback(async () => {
    // Reset archived task pagination when users refresh the Archive tab. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    await fetchTasksPage({ append: false });
  }, [fetchTasksPage]);

  const loadMoreRepos = useCallback(async () => {
    // Append more archived repositories when the list bottom is reached. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    if (!reposNextCursor || reposLoading || reposLoadingMore) return;
    await fetchReposPage({ append: true, cursor: reposNextCursor });
  }, [fetchReposPage, reposLoading, reposLoadingMore, reposNextCursor]);

  const loadMoreTasks = useCallback(async () => {
    // Append more archived tasks when the list bottom is reached. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    if (!tasksNextCursor || tasksLoading || tasksLoadingMore) return;
    await fetchTasksPage({ append: true, cursor: tasksNextCursor });
  }, [fetchTasksPage, tasksLoading, tasksLoadingMore, tasksNextCursor]);

  useEffect(() => {
    void refreshRepos();
    void refreshTasks();
  }, [refreshRepos, refreshTasks]);

  // Trigger archive repo pagination when the repos list sentinel is visible. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: reposLoadMoreRef,
    enabled: activeTab === 'repos' && Boolean(reposNextCursor) && !reposLoading && !reposLoadingMore,
    onLoadMore: () => void loadMoreRepos()
  });

  // Trigger archive task pagination when the tasks list sentinel is visible. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: tasksLoadMoreRef,
    enabled: activeTab === 'tasks' && Boolean(tasksNextCursor) && !tasksLoading && !tasksLoadingMore,
    onLoadMore: () => void loadMoreTasks()
  });

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

  // Derive the current tab display name for the PageNav header. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  const tabTitleKey = activeTab === 'tasks' ? 'archive.tabs.tasks' : 'archive.tabs.repos';

  // Render repos content section for the archive sidebar layout. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  const renderReposContent = () => (
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
        <>
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
          {/* Add an infinite-scroll sentinel to load more archived repos. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b */}
          <div ref={reposLoadMoreRef} data-testid="hc-archive-repos-load-more" />
          {reposLoadingMore ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
            </div>
          ) : null}
        </>
      ) : reposLoading ? (
        <CardListSkeleton count={6} cardClassName="hc-repo-card" testId="hc-archive-repos-skeleton" ariaLabel={t('common.loading')} />
      ) : (
        <div className="hc-empty">
          <Empty description={t('archive.repos.empty')} />
        </div>
      )}
    </>
  );

  // Render tasks content section for the archive sidebar layout. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  const renderTasksContent = () => (
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
        <>
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
          {/* Add an infinite-scroll sentinel to load more archived tasks. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b */}
          <div ref={tasksLoadMoreRef} data-testid="hc-archive-tasks-load-more" />
          {tasksLoadingMore ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
            </div>
          ) : null}
        </>
      ) : tasksLoading ? (
        <CardListSkeleton count={6} cardClassName="hc-task-card" testId="hc-archive-tasks-skeleton" ariaLabel={t('common.loading')} />
      ) : (
        <div className="hc-empty">
          <Empty description={t('archive.tasks.empty')} />
        </div>
      )}
    </>
  );

  // Render archive page with sidebar sub-navigation layout. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  return (
    <div className="hc-archive-layout">
      <ArchiveSidebar activeTab={activeTab} />
      <div className="hc-page hc-archive-page">
        <PageNav
          title={t(tabTitleKey as any)}
          actions={
            <Button icon={<ReloadOutlined />} onClick={() => void Promise.all([refreshRepos(), refreshTasks()])} loading={reposLoading || tasksLoading}>
              {t('common.refresh')}
            </Button>
          }
          navToggle={navToggle}
          userPanel={userPanel}
        />

        <div className="hc-page__body">
          <div className="hc-archive-tab-content">
            {activeTab === 'repos' ? renderReposContent() : renderTasksContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
