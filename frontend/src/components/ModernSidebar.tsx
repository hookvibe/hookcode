import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BugOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CodeOutlined,
  RightOutlined,
  FileTextOutlined,
  HourglassOutlined,
  LoadingOutlined,
  MessageOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ProjectOutlined,
  PullRequestOutlined,
  UnorderedListOutlined,
  ToolOutlined,
  CaretRightOutlined,
  InboxOutlined,
  CaretDownOutlined
} from '@ant-design/icons';
import type { Task, TaskGroup, TaskStatusStats } from '../api';
import { fetchAuthMe, fetchDashboardSidebar, fetchTaskGroups, fetchTasks } from '../api';
import { AUTH_CHANGED_EVENT, getToken } from '../auth';
import { useT } from '../i18n';
import {
  buildHomeHash,
  buildArchiveHash,
  buildReposHash,
  buildTaskGroupHash,
  buildTaskHash,
  buildTaskGroupsHash,
  buildTasksHash,
  buildSkillsHash,
  type RouteState
} from '../router';
import { navigateFromSidebar } from '../navHistory';
import { clampText, getTaskSidebarPrimaryText, getTaskSidebarSecondaryText } from '../utils/task';
import { createAuthedEventSource } from '../utils/sse';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

type SidebarTaskSectionKey = 'queued' | 'processing' | 'success' | 'failed';

const TASK_SECTIONS: Array<{
  key: SidebarTaskSectionKey;
  statusFilter: 'queued' | 'processing' | 'success' | 'failed';
  labelKey:
    | 'sidebar.tasks.queued'
    | 'sidebar.tasks.processing'
    | 'sidebar.tasks.completed'
    | 'sidebar.tasks.failed';
  icon: ReactNode;
}> = [
  { key: 'queued', statusFilter: 'queued', labelKey: 'sidebar.tasks.queued', icon: <HourglassOutlined /> },
  { key: 'processing', statusFilter: 'processing', labelKey: 'sidebar.tasks.processing', icon: <LoadingOutlined /> },
  { key: 'success', statusFilter: 'success', labelKey: 'sidebar.tasks.completed', icon: <CheckCircleFilled /> },
  { key: 'failed', statusFilter: 'failed', labelKey: 'sidebar.tasks.failed', icon: <CloseCircleFilled /> }
];

const defaultExpanded: Record<SidebarTaskSectionKey, boolean> = {
  queued: false,
  processing: false,
  success: false,
  failed: false
};

const defaultTasksByStatus: Record<SidebarTaskSectionKey, Task[]> = {
  queued: [],
  processing: [],
  success: [],
  failed: []
};

const defaultTasksByStatusCursor: Record<SidebarTaskSectionKey, string | null> = {
  // Initialize per-status cursors for sidebar pagination state. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  queued: null,
  processing: null,
  success: null,
  failed: null
};

const defaultTasksByStatusLoadState: Record<SidebarTaskSectionKey, boolean> = {
  // Track per-status load-more flags for sidebar pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  queued: false,
  processing: false,
  success: false,
  failed: false
};

const SIDEBAR_POLL_ACTIVE_MS = 10_000;
const SIDEBAR_POLL_IDLE_MS = 30_000;
const SIDEBAR_SSE_RECONNECT_BASE_MS = 2_000;
const SIDEBAR_SSE_RECONNECT_MAX_MS = 30_000;
const SIDER_COLLAPSED_STORAGE_KEY = 'hookcode-sider-collapsed';
const SIDEBAR_TASKS_INITIAL_SIZE = 3; // Keep the sidebar status preview short for fast loads. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
const SIDEBAR_TASKS_PAGE_SIZE = 10; // Append more status tasks per infinite scroll page. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
const SIDEBAR_TASK_GROUPS_PAGE_SIZE = 50; // Align sidebar task-group pagination with existing list size. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227

const getStoredSiderCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage?.getItem(SIDER_COLLAPSED_STORAGE_KEY) ?? '';
  return stored === '1' || stored === 'true';
};

export interface ModernSidebarProps {
  route: RouteState;
  className?: string;
  isMobileLayout?: boolean;
  mobileNavOpen?: boolean;
  onCloseMobileNav?: () => void;
}

// Fix sidebar abnormal behavior in collapsed state (header alignment, padding, nesting). docs/en/developer/plans/sidebar-collapsed-fix-20260205/task_plan.md sidebar-collapsed-fix-20260205
export const ModernSidebar: FC<ModernSidebarProps> = ({
  route,
  className,
  isMobileLayout,
  mobileNavOpen,
  onCloseMobileNav
}) => {
  const t = useT();
  const taskSectionAutoInitRef = useRef(false);
  const refreshSidebarPromiseRef = useRef<Promise<TaskStatusStats | null> | null>(null);
  const sidebarSseRefreshTimerRef = useRef<number | null>(null);
  const refreshSidebarQueuedRef = useRef(false);
  const sidebarSseReconnectTimerRef = useRef<number | null>(null);
  const sidebarSseReconnectBackoffRef = useRef<number>(SIDEBAR_SSE_RECONNECT_BASE_MS);
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const taskGroupsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const queuedLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const processingLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const successLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const failedLoadMoreRef = useRef<HTMLDivElement | null>(null);

  const [authToken, setAuthToken] = useState<string | null>(() => getToken());
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [siderCollapsed, setSiderCollapsed] = useState(() => getStoredSiderCollapsed());
  const [taskSectionExpanded, setTaskSectionExpanded] = useState<Record<SidebarTaskSectionKey, boolean>>(defaultExpanded);

  const [taskStats, setTaskStats] = useState<TaskStatusStats>({
    total: 0,
    queued: 0,
    processing: 0,
    success: 0,
    failed: 0
  });
  const [tasksByStatus, setTasksByStatus] = useState<Record<SidebarTaskSectionKey, Task[]>>(defaultTasksByStatus);
  const [tasksByStatusNextCursor, setTasksByStatusNextCursor] = useState<Record<SidebarTaskSectionKey, string | null>>(defaultTasksByStatusCursor); // Track cursors for sidebar status pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const [tasksByStatusLoadingMore, setTasksByStatusLoadingMore] = useState<Record<SidebarTaskSectionKey, boolean>>(defaultTasksByStatusLoadState); // Track load-more spinners per status. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const [tasksByStatusLoadedExtra, setTasksByStatusLoadedExtra] = useState<Record<SidebarTaskSectionKey, boolean>>(defaultTasksByStatusLoadState); // Track which status lists have extra pages. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [sidebarSseConnected, setSidebarSseConnected] = useState(false);
  const [taskGroupsNextCursor, setTaskGroupsNextCursor] = useState<string | null>(null); // Track sidebar task-group cursor for load-more paging. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  const [taskGroupsLoadingMore, setTaskGroupsLoadingMore] = useState(false);
  const [taskGroupsLoadedExtra, setTaskGroupsLoadedExtra] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(SIDER_COLLAPSED_STORAGE_KEY, siderCollapsed ? '1' : '0');
  }, [siderCollapsed]);

  const refreshAuthState = useCallback(async () => {
    try {
      const me = await fetchAuthMe();
      setAuthEnabled(Boolean(me?.authEnabled));
    } catch (err: any) {
      setAuthEnabled(true);
    }
  }, []);

  useEffect(() => {
    const onAuth = () => {
      setAuthToken(getToken());
      void refreshAuthState();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuth);
  }, [refreshAuthState]);

  useEffect(() => {
    void refreshAuthState();
  }, [refreshAuthState]);

  const loadMoreTaskGroups = useCallback(async () => {
    // Append additional task groups when sidebar infinite scroll reaches the end. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    if (!taskGroupsNextCursor || taskGroupsLoadingMore) return;
    setTaskGroupsLoadingMore(true);
    setTaskGroupsLoadedExtra(true);
    try {
      const { taskGroups: more, nextCursor } = await fetchTaskGroups({
        limit: SIDEBAR_TASK_GROUPS_PAGE_SIZE,
        cursor: taskGroupsNextCursor
      });
      setTaskGroups((prev) => {
        const existing = new Set(prev.map((group) => group.id));
        return [...prev, ...more.filter((group) => !existing.has(group.id))];
      });
      setTaskGroupsNextCursor(nextCursor ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setTaskGroupsLoadingMore(false);
    }
  }, [taskGroupsLoadingMore, taskGroupsNextCursor]);

  const loadMoreTasksByStatus = useCallback(
    async (statusKey: SidebarTaskSectionKey) => {
      // Append additional sidebar tasks for a specific status bucket. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
      const cursor = tasksByStatusNextCursor[statusKey];
      if (!cursor || tasksByStatusLoadingMore[statusKey]) return;
      setTasksByStatusLoadingMore((prev) => ({ ...prev, [statusKey]: true }));
      setTasksByStatusLoadedExtra((prev) => ({ ...prev, [statusKey]: true }));
      try {
        const { tasks: more, nextCursor } = await fetchTasks({
          limit: SIDEBAR_TASKS_PAGE_SIZE,
          cursor,
          status: statusKey,
          includeQueue: false
        });
        setTasksByStatus((prev) => {
          const existing = new Set(prev[statusKey].map((task) => task.id));
          return { ...prev, [statusKey]: [...prev[statusKey], ...more.filter((task) => !existing.has(task.id))] };
        });
        setTasksByStatusNextCursor((prev) => ({ ...prev, [statusKey]: nextCursor ?? null }));
      } catch (err) {
        console.error(err);
      } finally {
        setTasksByStatusLoadingMore((prev) => ({ ...prev, [statusKey]: false }));
      }
    },
    [tasksByStatusLoadingMore, tasksByStatusNextCursor]
  );

  const refreshSidebar = useCallback(async (): Promise<TaskStatusStats | null> => {
    if (refreshSidebarPromiseRef.current) {
      refreshSidebarQueuedRef.current = true;
      return refreshSidebarPromiseRef.current;
    }

    refreshSidebarPromiseRef.current = (async () => {
      const canQuery = authEnabled === false || Boolean(authToken);
      if (!canQuery) {
        setTaskStats({ total: 0, queued: 0, processing: 0, success: 0, failed: 0 });
        setTasksByStatus(defaultTasksByStatus);
        // Reset sidebar status pagination state when auth is unavailable. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
        setTasksByStatusNextCursor(defaultTasksByStatusCursor);
        setTasksByStatusLoadedExtra(defaultTasksByStatusLoadState);
        setTasksByStatusLoadingMore(defaultTasksByStatusLoadState);
        setTaskGroups([]);
        setTaskGroupsNextCursor(null);
        setTaskGroupsLoadedExtra(false);
        taskSectionAutoInitRef.current = false;
        return null;
      }

      setSidebarLoading(true);
      try {
        const snapshot = await fetchDashboardSidebar({ tasksLimit: SIDEBAR_TASKS_INITIAL_SIZE, taskGroupsLimit: SIDEBAR_TASK_GROUPS_PAGE_SIZE });
        const { stats, tasksByStatus, taskGroups: groups } = snapshot;
        const queued = tasksByStatus.queued.slice(0, SIDEBAR_TASKS_INITIAL_SIZE);
        const processing = tasksByStatus.processing.slice(0, SIDEBAR_TASKS_INITIAL_SIZE);
        const success = tasksByStatus.success.slice(0, SIDEBAR_TASKS_INITIAL_SIZE);
        const failed = tasksByStatus.failed.slice(0, SIDEBAR_TASKS_INITIAL_SIZE);

        setTaskStats(stats);
        setTasksByStatus((prev) => {
          // Merge the latest status snapshot with any previously loaded pages. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
          const next: Record<SidebarTaskSectionKey, Task[]> = { ...prev };
          const updates: Record<SidebarTaskSectionKey, Task[]> = { queued, processing, success, failed };
          (Object.keys(updates) as SidebarTaskSectionKey[]).forEach((key) => {
            if (!tasksByStatusLoadedExtra[key]) {
              next[key] = updates[key];
              return;
            }
            const freshIds = new Set(updates[key].map((task) => task.id));
            next[key] = [...updates[key], ...prev[key].filter((task) => !freshIds.has(task.id))];
          });
          return next;
        });
        setTasksByStatusNextCursor((prev) => {
          // Preserve pagination cursors once extra pages are loaded. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
          const next = { ...prev };
          const snapshotCursors = snapshot.tasksByStatusNextCursor ?? {};
          (Object.keys(defaultTasksByStatusCursor) as SidebarTaskSectionKey[]).forEach((key) => {
            if (tasksByStatusLoadedExtra[key]) return;
            next[key] = snapshotCursors[key] ?? null;
          });
          return next;
        });
        setTaskSectionExpanded((prev) => {
          // Keep task status sections collapsed on refresh unless the user expands them. docs/en/developer/plans/taskmenu-collapse-20260305/task_plan.md taskmenu-collapse-20260305
          if (!taskSectionAutoInitRef.current) {
            taskSectionAutoInitRef.current = true;
          }
          return prev;
        });

        const sorted = [...groups].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setTaskGroups((prev) => {
          if (!taskGroupsLoadedExtra) return sorted;
          // Merge fresh first-page results into the existing sidebar list when extra pages are loaded. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
          const freshIds = new Set(sorted.map((group) => group.id));
          return [...sorted, ...prev.filter((group) => !freshIds.has(group.id))];
        });
        if (!taskGroupsLoadedExtra) {
          setTaskGroupsNextCursor(snapshot.taskGroupsNextCursor ?? null);
        }
        return stats;
      } catch {
        // Keep sidebar polling failures non-fatal because the last successful snapshot remains usable during task-group workspace debugging. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
        return null;
      } finally {
        setSidebarLoading(false);
      }
    })().finally(() => {
      refreshSidebarPromiseRef.current = null;
      if (!refreshSidebarQueuedRef.current) return;
      refreshSidebarQueuedRef.current = false;
      void refreshSidebar();
    });

    return refreshSidebarPromiseRef.current;
  }, [authEnabled, authToken, taskGroupsLoadedExtra, tasksByStatusLoadedExtra]);

  // SSE and Polling logic omitted for brevity as it's identical to AppShell. 
  // Ideally, this should be a custom hook `useDashboardSidebar` to share logic.
  // For now, I will include the simplified polling effect to make it functional.
  
  useEffect(() => {
     let disposed = false;
     let timer: number | null = null;
     const loop = async () => {
         if (disposed) return;
         if (document.visibilityState === 'hidden') {
             timer = window.setTimeout(loop, SIDEBAR_POLL_IDLE_MS);
             return;
         }
         const stats = await refreshSidebar();
         if (disposed) return;
         // Back off to the idle interval after failed sidebar refreshes so transient backend issues do not spam the console/network panel. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
         timer = window.setTimeout(loop, stats ? SIDEBAR_POLL_ACTIVE_MS : SIDEBAR_POLL_IDLE_MS);
     }
     void loop();
     return () => {
         disposed = true;
         if (timer) clearTimeout(timer);
     }
  }, [refreshSidebar]);

  // Trigger sidebar task-group pagination when the scroll sentinel is visible. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  useInfiniteScroll({
    targetRef: taskGroupsLoadMoreRef,
    rootRef: sidebarScrollRef,
    enabled: !siderCollapsed && Boolean(taskGroupsNextCursor) && !taskGroupsLoadingMore && !sidebarLoading,
    onLoadMore: () => void loadMoreTaskGroups()
  });

  // Trigger queued task pagination when the status sentinel is visible. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: queuedLoadMoreRef,
    rootRef: sidebarScrollRef,
    enabled:
      !siderCollapsed &&
      taskSectionExpanded.queued &&
      Boolean(tasksByStatusNextCursor.queued) &&
      !tasksByStatusLoadingMore.queued &&
      !sidebarLoading,
    onLoadMore: () => void loadMoreTasksByStatus('queued')
  });

  // Trigger processing task pagination when the status sentinel is visible. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: processingLoadMoreRef,
    rootRef: sidebarScrollRef,
    enabled:
      !siderCollapsed &&
      taskSectionExpanded.processing &&
      Boolean(tasksByStatusNextCursor.processing) &&
      !tasksByStatusLoadingMore.processing &&
      !sidebarLoading,
    onLoadMore: () => void loadMoreTasksByStatus('processing')
  });

  // Trigger success task pagination when the status sentinel is visible. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: successLoadMoreRef,
    rootRef: sidebarScrollRef,
    enabled:
      !siderCollapsed &&
      taskSectionExpanded.success &&
      Boolean(tasksByStatusNextCursor.success) &&
      !tasksByStatusLoadingMore.success &&
      !sidebarLoading,
    onLoadMore: () => void loadMoreTasksByStatus('success')
  });

  // Trigger failed task pagination when the status sentinel is visible. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  useInfiniteScroll({
    targetRef: failedLoadMoreRef,
    rootRef: sidebarScrollRef,
    enabled:
      !siderCollapsed &&
      taskSectionExpanded.failed &&
      Boolean(tasksByStatusNextCursor.failed) &&
      !tasksByStatusLoadingMore.failed &&
      !sidebarLoading,
    onLoadMore: () => void loadMoreTasksByStatus('failed')
  });


  const navigate = (hash: string) => {
    navigateFromSidebar(hash);
    if (isMobileLayout && onCloseMobileNav) {
      onCloseMobileNav();
    }
  };

  const activeGroupKey = route.page === 'taskGroup' ? route.taskGroupId : undefined;
  const taskGroupsListActive = route.page === 'taskGroups';
  const reposActive = route.page === 'repos' || route.page === 'repo';
  const archiveActive = route.page === 'archive';
  const skillsActive = route.page === 'skills'; // Highlight the skills registry nav state. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const activeTaskId = route.page === 'task' ? route.taskId : undefined;
  const activeTasksStatus = route.page === 'tasks' ? route.tasksStatus : undefined;

  const renderTaskSection = (sectionKey: SidebarTaskSectionKey) => {
    const section = TASK_SECTIONS.find((s) => s.key === sectionKey);
    if (!section) return null;
    const items = tasksByStatus[sectionKey] ?? [];
    const loadMoreRef =
      sectionKey === 'queued'
        ? queuedLoadMoreRef
        : sectionKey === 'processing'
          ? processingLoadMoreRef
          : sectionKey === 'success'
            ? successLoadMoreRef
            : failedLoadMoreRef;
    const count =
        sectionKey === 'queued' ? taskStats.queued :
        sectionKey === 'processing' ? taskStats.processing :
        sectionKey === 'success' ? taskStats.success : taskStats.failed;
    
    const expanded = taskSectionExpanded[sectionKey];
    const isActive = activeTasksStatus === section.statusFilter;

    if (siderCollapsed) {
        return (
            <button 
                key={sectionKey}
                className={`hc-nav-item ${isActive ? 'hc-nav-item--active' : ''}`}
                title={t(section.labelKey)}
                onClick={() => navigate(buildTasksHash({ status: section.statusFilter }))}
            >
                <span className="hc-nav-icon">{section.icon}</span>
                <span className="hc-nav-badge">{count}</span>
            </button>
        );
    }

    return (
      <div className="hc-sidebar-section" key={sectionKey}>
         <div className="hc-task-status-row">
             <button 
                className="hc-task-status-toggle"
                onClick={() => setTaskSectionExpanded(p => ({...p, [sectionKey]: !p[sectionKey]}))}
             >
                 <span style={{ fontSize: 10 }}>{expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}</span>
                 <span>{t(section.labelKey)}</span>
                 <span style={{ fontSize: 11, opacity: 0.6 }}>{count}</span>
             </button>
         </div>
        
        {/* Expanded Items */}
        {expanded && (
            <div className="hc-sidebar-section-items">
                {items.map(task => (
                    <button
                        key={task.id}
                        className={`hc-nav-item ${activeTaskId === task.id ? 'hc-nav-item--active' : ''}`}
                        onClick={() => navigate(buildTaskHash(task.id))}
                        title={getTaskSidebarPrimaryText(t, task)}
                    >
                        <span className="hc-nav-icon" style={{ fontSize: 14 }}>{section.icon}</span>
                        <div style={{ overflow: 'hidden', textAlign: 'left' }}>
                            <div className="hc-nav-label">{clampText(getTaskSidebarPrimaryText(t, task), 24)}</div>
                            <div className="hc-nav-label" style={{ fontSize: 11, opacity: 0.6 }}>{clampText(getTaskSidebarSecondaryText(task), 24)}</div>
                        </div>
                    </button>
                ))}
                {count > 3 && (
                    <button 
                        className="hc-nav-item hc-nav-view-all"
                        onClick={() => navigate(buildTasksHash({ status: section.statusFilter }))}
                        title={t('sidebar.tasks.viewAll')}
                    >
                        {t('sidebar.tasks.viewAll')}
                    </button>
                )}
                {/* Add an infinite-scroll sentinel to load more status tasks. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b */}
                <div ref={loadMoreRef} data-testid={`hc-sidebar-${sectionKey}-load-more`} />
                {tasksByStatusLoadingMore[sectionKey] ? (
                  <div style={{ padding: '6px 12px' }}>
                    <span className="hc-nav-label">{t('common.loading')}</span>
                  </div>
                ) : null}
            </div>
        )}
      </div>
    );
  };

  if (authEnabled !== false && !authToken) return null;

  return (
    <nav className={`hc-modern-sidebar ${siderCollapsed ? 'hc-modern-sidebar--collapsed' : ''} ${className || ''}`}>
      {/* Header */}
      <div className="hc-sidebar-header">
        {!siderCollapsed && <div className="hc-sidebar-brand">{t('app.brand')}</div>}
        <button 
            className="hc-sidebar-toggle" 
            onClick={() => setSiderCollapsed(!siderCollapsed)}
            title={siderCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        >
            {siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      {/* Primary Action */}
      <div className="hc-sidebar-action-area">
          <button 
            className="hc-sidebar-primary-action"
            onClick={() => navigate(buildHomeHash())}
            title={t('sidebar.newTaskGroup')}
          >
              <span className="hc-nav-icon"><PlusOutlined /></span>
              <span>{t('sidebar.newTaskGroup')}</span>
          </button>
      </div>

      {/* Scrollable Content */}
      <div className="hc-sidebar-content" ref={sidebarScrollRef}>
          
          {/* Section: Repos */}
          <div className="hc-sidebar-section">
              <div className="hc-sidebar-section-title">{t('sidebar.section.repos')}</div>
              <button 
                className={`hc-nav-item ${reposActive ? 'hc-nav-item--active' : ''}`}
                onClick={() => navigate(buildReposHash())}
                title={t('sidebar.nav.repos')}
              >
                  <span className="hc-nav-icon"><ProjectOutlined /></span>
                  <span className="hc-nav-label">{t('sidebar.nav.repos')}</span>
              </button>
          </div>

          <div className="hc-sidebar-divider" />

          {/* Section: Tasks */}
          <div className="hc-sidebar-section">
               <div className="hc-sidebar-section-title">{t('sidebar.section.tasks')}</div>
               {renderTaskSection('queued')}
               {renderTaskSection('processing')}
               {renderTaskSection('success')}
               {renderTaskSection('failed')}
          </div>

          <div className="hc-sidebar-divider" />

          {/* Section: Task Groups */}
          <div className="hc-sidebar-section">
               {!siderCollapsed && (
                   <div className="hc-task-status-row" style={{ padding: '0 12px', marginBottom: 4 }}>
                       <div className="hc-sidebar-section-title" style={{ margin: 0, padding: 0 }}>{t('sidebar.section.taskGroups')}</div>
                       <button 
                        className="hc-sidebar-toggle" 
                        style={{ width: 'auto', padding: 4 }}
                        onClick={() => navigate(buildTaskGroupsHash())}
                        title={t('taskGroups.page.viewAll')}
                       >
                           <UnorderedListOutlined />
                       </button>
                   </div>
               )}
               {siderCollapsed && (
                   <button 
                    className={`hc-nav-item ${taskGroupsListActive ? 'hc-nav-item--active' : ''}`}
                    onClick={() => navigate(buildTaskGroupsHash())}
                    title={t('taskGroups.page.viewAll')}
                   >
                       <span className="hc-nav-icon"><UnorderedListOutlined /></span>
                   </button>
               )}
               
                {!siderCollapsed && taskGroups.map(g => {
                  const showActivityDot = Boolean(g.previewActive || g.hasRunningTasks);
                  return (
                    <button
                     key={g.id}
                     className={`hc-nav-item ${activeGroupKey === g.id ? 'hc-nav-item--active' : ''}`}
                     onClick={() => navigate(buildTaskGroupHash(g.id))}
                     title={g.title || g.id}
                    >
                        <span className="hc-nav-icon">
                            {g.kind === 'chat' ? <MessageOutlined /> : 
                             g.kind === 'issue' ? <BugOutlined /> :
                             g.kind === 'merge_request' ? <PullRequestOutlined /> :
                             g.kind === 'commit' ? <CodeOutlined /> : <FileTextOutlined />}
                        </span>
                        <span className="hc-nav-group-label">
                          <span className="hc-nav-group-text">{clampText(g.title || g.id, 28)}</span>
                          {/* Show activity dots when previews or running tasks exist. docs/en/developer/plans/taskgroup-running-dot-20260305/task_plan.md taskgroup-running-dot-20260305 */}
                          {showActivityDot ? <span className="hc-nav-preview-dot" aria-hidden="true" /> : null}
                        </span>
                    </button>
                  );
                })}
                {/* Add a sidebar load-more sentinel for task groups. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227 */}
                {!siderCollapsed ? <div ref={taskGroupsLoadMoreRef} data-testid="hc-sidebar-taskgroups-load-more" /> : null}
                {taskGroupsLoadingMore ? (
                  <div style={{ padding: '6px 12px' }}>
                    <span className="hc-nav-label">{t('common.loading')}</span>
                  </div>
                ) : null}
          </div>

      </div>

      {/* Footer */}
      <div className="hc-sidebar-footer">
          {/* Surface the skills registry page in the sidebar footer. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
          <button
            className={`hc-nav-item ${skillsActive ? 'hc-nav-item--active' : ''}`}
            onClick={() => navigate(buildSkillsHash())}
            title={t('sidebar.nav.skills')}
          >
              <span className="hc-nav-icon"><ToolOutlined /></span>
              <span className="hc-nav-label">{t('sidebar.nav.skills')}</span>
          </button>
          <button 
            className={`hc-nav-item ${archiveActive ? 'hc-nav-item--active' : ''}`}
            onClick={() => navigate(buildArchiveHash())}
            title={t('sidebar.nav.archive')}
          >
              <span className="hc-nav-icon"><InboxOutlined /></span>
              <span className="hc-nav-label">{t('sidebar.nav.archive')}</span>
          </button>
      </div>

    </nav>
  );
};
