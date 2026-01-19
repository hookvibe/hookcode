import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import {
  BugOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CodeOutlined,
  FileTextOutlined,
  HourglassOutlined,
  LoadingOutlined,
  MessageOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ProjectOutlined,
  PullRequestOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Task, TaskGroup, TaskStatusStats } from '../api';
import { fetchAuthMe, fetchDashboardSidebar } from '../api';
import { AUTH_CHANGED_EVENT, getToken } from '../auth';
import { useT } from '../i18n';
import {
  buildHomeHash,
  buildReposHash,
  buildTaskGroupHash,
  buildTaskHash,
  buildTasksHash,
  type RouteState
} from '../router';
import { navigateFromSidebar } from '../navHistory';
import { clampText, getTaskTitle } from '../utils/task';
import { createAuthedEventSource } from '../utils/sse';
import type { AccentPreset } from '../theme/accent';
import { UserPanelPopover } from '../components/UserPanelPopover';
import { LoginCardSkeleton } from '../components/skeletons/LoginCardSkeleton';
import { LoginPage } from './LoginPage';
import { RepoDetailPage } from './RepoDetailPage';
import { ReposPage } from './ReposPage';
import { TaskDetailPage } from './TaskDetailPage';
import { TaskGroupChatPage } from './TaskGroupChatPage';
import { TasksPage } from './TasksPage';

const { Sider, Content } = Layout;

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * AppShell:
 * - Business context: the new `frontend-chat` main layout (sidebar + content).
 * - Scope (migration step 1):
 *   - Home page defaults to chat view (root `#/` and alias `#/chat`).
 *   - Sidebar shows task status sections (queued/processing/completed/failed) with collapse + top 3 items.
 *   - Sidebar shows recent task groups that open the new chat-style group view.
 *
 * Change record:
 * - 2026-01-11: Introduced as the first stage of migrating the legacy frontend into `frontend-chat`.
 * - 2026-01-11: Render the chat page with a single component instance to avoid unnecessary unmounts when switching `#/` <-> `#/task-groups/:id`.
 * - 2026-01-12: Sidebar UX: split into Repos / Tasks / Task groups sections; move task status icons into task rows; auto-collapse empty task sections; header click toggles; add "View all" entry when count > 3; add task group icons.
 */

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

export interface AppShellProps {
  route: RouteState;
  themePreference: ThemePreference;
  onThemePreferenceChange: (next: ThemePreference) => void;
  accentPreset: AccentPreset;
  onAccentPresetChange: (next: AccentPreset) => void;
}

const defaultExpanded: Record<SidebarTaskSectionKey, boolean> = {
  // UX: default to collapsed so the sidebar stays compact before the first refresh finishes.
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

const SIDEBAR_POLL_ACTIVE_MS = 10_000;
const SIDEBAR_POLL_IDLE_MS = 30_000; // Slow down when no tasks are queued/processing. 7bqwou6abx4ste96ikhv
const SIDEBAR_POLL_ERROR_MS = 2_000; // Retry faster while backend is starting to avoid SSE/proxy spam. 58w1q3n5nr58flmempxe
const SIDEBAR_SSE_RECONNECT_BASE_MS = 2_000;
const SIDEBAR_SSE_RECONNECT_MAX_MS = 30_000; // Cap SSE reconnect backoff to reduce dev proxy spam when backend is down. 58w1q3n5nr58flmempxe

export const AppShell: FC<AppShellProps> = ({
  route,
  themePreference,
  onThemePreferenceChange,
  accentPreset,
  onAccentPresetChange
}) => {
  const t = useT();
  const taskSectionAutoInitRef = useRef(false);
  const refreshSidebarPromiseRef = useRef<Promise<TaskStatusStats | null> | null>(null); // Deduplicate sidebar refresh calls to avoid overlapping polling bursts. 7bqwou6abx4ste96ikhv
  const sidebarSseRefreshTimerRef = useRef<number | null>(null); // Coalesce SSE-driven refresh bursts to avoid thundering herds. kxthpiu4eqrmu0c6bboa
  const refreshSidebarQueuedRef = useRef(false); // Avoid dropping refresh signals when a refresh is already in-flight. kxthpiu4eqrmu0c6bboa
  const sidebarSseReconnectTimerRef = useRef<number | null>(null); // Retry SSE with backoff to avoid hammering the dev proxy. 58w1q3n5nr58flmempxe
  const sidebarSseReconnectBackoffRef = useRef<number>(SIDEBAR_SSE_RECONNECT_BASE_MS); // Persist backoff across reconnect attempts. 58w1q3n5nr58flmempxe

  const [authToken, setAuthToken] = useState<string | null>(() => getToken());
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [taskLogsEnabled, setTaskLogsEnabled] = useState<boolean | null>(null); // Cache backend feature toggles from `/auth/me` for downstream UI guards. 0nazpc53wnvljv5yh7c6
  const [authChecking, setAuthChecking] = useState(true);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [taskSectionExpanded, setTaskSectionExpanded] = useState<Record<SidebarTaskSectionKey, boolean>>(defaultExpanded);

  const [taskStats, setTaskStats] = useState<TaskStatusStats>({
    total: 0,
    queued: 0,
    processing: 0,
    success: 0,
    failed: 0
  });
  const [tasksByStatus, setTasksByStatus] = useState<Record<SidebarTaskSectionKey, Task[]>>(defaultTasksByStatus);
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [sidebarSseConnected, setSidebarSseConnected] = useState(false);
  const [sidebarSseReady, setSidebarSseReady] = useState(false); // Gate SSE until the backend is reachable to prevent startup proxy errors. 58w1q3n5nr58flmempxe

  const refreshAuthState = useCallback(async () => {
    setAuthChecking(true);
    try {
      const me = await fetchAuthMe();
      setAuthEnabled(Boolean(me?.authEnabled));
      setTaskLogsEnabled(Boolean(me?.features?.taskLogsEnabled));
    } catch (err: any) {
      // When auth is enabled but token is missing/invalid, `/auth/me` returns 401.
      const status = err?.response?.status;
      setAuthEnabled(true);
      setTaskLogsEnabled(null);
      if (status !== 401) {
        console.warn('[auth] fetchAuthMe failed; falling back to authEnabled=true', err);
      }
    } finally {
      setAuthChecking(false);
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

  useEffect(() => {
    // UX guard: if a logged-in user lands on `#/login`, send them to Home to avoid a blank page.
    if ((authToken || authEnabled === false) && route.page === 'login') {
      window.location.hash = buildHomeHash();
    }
  }, [authEnabled, authToken, route.page]);

  const refreshSidebar = useCallback(async (): Promise<TaskStatusStats | null> => {
    if (refreshSidebarPromiseRef.current) {
      // Queue a single follow-up refresh so SSE/poll signals are not lost during an in-flight request. kxthpiu4eqrmu0c6bboa
      refreshSidebarQueuedRef.current = true;
      return refreshSidebarPromiseRef.current;
    }

    refreshSidebarPromiseRef.current = (async () => {
      // Business intent: support "auth disabled" environments (no login required) while keeping login guards for normal deployments.
      const canQuery = authEnabled === false || Boolean(authToken);
      if (!canQuery) {
        setTaskStats({ total: 0, queued: 0, processing: 0, success: 0, failed: 0 });
        setTasksByStatus(defaultTasksByStatus);
        setTaskGroups([]);
        // UX: reset the auto-init state so the next successful refresh can apply the "empty sections collapsed" default again.
        taskSectionAutoInitRef.current = false;
        return null;
      }

      setSidebarLoading(true);
      try {
        const snapshot = await fetchDashboardSidebar({ tasksLimit: 3, taskGroupsLimit: 50 });
        const { stats, tasksByStatus, taskGroups: groups } = snapshot;
        const queued = tasksByStatus.queued.slice(0, 3);
        const processing = tasksByStatus.processing.slice(0, 3);
        const success = tasksByStatus.success.slice(0, 3);
        const failed = tasksByStatus.failed.slice(0, 3);

        setTaskStats(stats);
        setTasksByStatus({ queued, processing, success, failed });
        setTaskSectionExpanded((prev) => {
          // UX:
          // - Default collapsed, but auto-expand when there are tasks updated within the last 24 hours.
          // - Apply only once per auth session to avoid overriding user's manual expand/collapse preference.
          if (taskSectionAutoInitRef.current) return prev;
          taskSectionAutoInitRef.current = true;
          const now = Date.now();
          const recentWindowMs = 24 * 60 * 60 * 1000;
          const isRecent = (task: Task): boolean => {
            const ts = new Date(task.updatedAt).getTime();
            if (!Number.isFinite(ts)) return false;
            // Note: use absolute delta to tolerate minor server/client clock skew.
            return Math.abs(now - ts) <= recentWindowMs;
          };
          const hasRecentTasks = (list: Task[]): boolean => list.some(isRecent);
          return {
            queued: hasRecentTasks(queued),
            processing: hasRecentTasks(processing),
            success: hasRecentTasks(success),
            failed: hasRecentTasks(failed)
          };
        });

        const sorted = [...groups].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setTaskGroups(sorted);
        return stats;
      } catch (err) {
        console.error(err);
        // Sidebar errors should not block the whole app; keep last known values.
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
  }, [authEnabled, authToken]);

  useEffect(() => {
    const canQuery = authEnabled === false || Boolean(authToken);
    if (!canQuery) {
      setSidebarSseConnected(false);
      return;
    }

    let disposed = false;
    let eventSource: EventSource | null = null;

    const close = () => {
      eventSource?.close();
      eventSource = null;
      setSidebarSseConnected(false);
      if (sidebarSseRefreshTimerRef.current !== null) {
        window.clearTimeout(sidebarSseRefreshTimerRef.current);
        sidebarSseRefreshTimerRef.current = null;
      }
      if (sidebarSseReconnectTimerRef.current !== null) {
        window.clearTimeout(sidebarSseReconnectTimerRef.current);
        sidebarSseReconnectTimerRef.current = null;
      }
    };

    const scheduleRefresh = () => {
      if (sidebarSseRefreshTimerRef.current !== null) return;
      const jitterMs = Math.floor(Math.random() * 300);
      sidebarSseRefreshTimerRef.current = window.setTimeout(() => {
        sidebarSseRefreshTimerRef.current = null;
        if (disposed) return;
        if (document.visibilityState === 'hidden') return;
        void refreshSidebar();
      }, jitterMs);
    };

    const scheduleReconnect = () => {
      if (sidebarSseReconnectTimerRef.current !== null) return;
      const base = Math.max(SIDEBAR_SSE_RECONNECT_BASE_MS, sidebarSseReconnectBackoffRef.current || 0);
      const jitterMs = Math.floor(Math.random() * 300);
      const delayMs = Math.min(base, SIDEBAR_SSE_RECONNECT_MAX_MS) + jitterMs;
      // Exponential backoff reduces noisy `/api/events/stream` proxy errors when backend is down. 58w1q3n5nr58flmempxe
      sidebarSseReconnectBackoffRef.current = Math.min(base * 2, SIDEBAR_SSE_RECONNECT_MAX_MS);
      sidebarSseReconnectTimerRef.current = window.setTimeout(() => {
        sidebarSseReconnectTimerRef.current = null;
        if (disposed) return;
        if (document.visibilityState === 'hidden') return;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (eventSource) return;
      if (document.visibilityState === 'hidden') return;
      // Subscribe to the shared SSE channel and refresh the sidebar only when it actually changes. kxthpiu4eqrmu0c6bboa
      eventSource = createAuthedEventSource('/events/stream', { topics: 'dashboard' });
      eventSource.addEventListener('open', () => {
        if (disposed) return;
        sidebarSseReconnectBackoffRef.current = SIDEBAR_SSE_RECONNECT_BASE_MS;
        setSidebarSseConnected(true);
      });
      eventSource.addEventListener('error', () => {
        if (disposed) return;
        close();
        scheduleReconnect();
      });
      eventSource.addEventListener('dashboard.sidebar.changed', () => {
        if (disposed) return;
        scheduleRefresh();
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        close();
        return;
      }
      connect();
      scheduleRefresh();
    };

    connect();
    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      close();
    };
  }, [authEnabled, authToken, refreshSidebar]);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;

    const stop = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const schedule = (delayMs: number) => {
      stop();
      timer = window.setTimeout(async () => {
        timer = null;
        if (disposed) return;
        if (document.visibilityState === 'hidden') return;

        // Pause sidebar polling when the tab is hidden and slow down when the queue is idle. 7bqwou6abx4ste96ikhv
        const stats = await refreshSidebar();
        if (disposed) return;
        const hasActiveTasks = Boolean(stats && (stats.queued > 0 || stats.processing > 0));
        schedule(hasActiveTasks ? SIDEBAR_POLL_ACTIVE_MS : SIDEBAR_POLL_IDLE_MS);
      }, delayMs);
    };

    const resume = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      if (sidebarSseConnected) {
        // When SSE is connected, rely on push-based refresh and keep polling as a fallback only. kxthpiu4eqrmu0c6bboa
        stop();
        return;
      }
      schedule(0);
    };

    resume();
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      stop();
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [refreshSidebar, sidebarSseConnected]);

  const openTask = useCallback((task: Task) => {
    // Navigation rule: clicking in the left sidebar is treated as a global section switch,
    // so we clear the header-back chain for the destination page.
    navigateFromSidebar(buildTaskHash(task.id));
  }, []);

  const openTaskGroup = useCallback((groupId: string) => {
    // Navigation rule: sidebar menu clicks should not "inherit" the previous page as a back target.
    navigateFromSidebar(buildTaskGroupHash(groupId));
  }, []);

  const goHome = useCallback(() => {
    // Navigation rule: sidebar navigation (home/new group) resets the header-back chain.
    navigateFromSidebar(buildHomeHash());
  }, []);

  const goRepos = useCallback(() => {
    // Navigation rule: sidebar navigation (repos) resets the header-back chain.
    navigateFromSidebar(buildReposHash());
  }, []);

  const groupMenuItems = useMemo<MenuProps['items']>(() => {
    return taskGroups.map((g) => ({
      key: g.id,
      // UX: icons make the group list scannable, especially in collapsed sidebar mode.
      icon:
        g.kind === 'chat' ? (
          <MessageOutlined />
        ) : g.kind === 'issue' ? (
          <BugOutlined />
        ) : g.kind === 'merge_request' ? (
          <PullRequestOutlined />
        ) : g.kind === 'commit' ? (
          <CodeOutlined />
        ) : (
          <FileTextOutlined />
        ),
      label: clampText(String(g.title ?? g.bindingKey ?? g.id).trim() || g.id, 36)
    }));
  }, [taskGroups]);

  const activeGroupKey = route.page === 'taskGroup' ? route.taskGroupId : undefined;
  const reposActive = route.page === 'repos' || route.page === 'repo';
  const activeTaskId = route.page === 'task' ? route.taskId : undefined;
  const activeTasksStatus =
    route.page === 'tasks'
      ? (() => {
          // Compatibility: TasksPage normalizes `completed` to `success`, so we do the same for sidebar highlighting.
          const raw = String(route.tasksStatus ?? '').trim();
          if (!raw) return undefined;
          if (raw === 'completed') return 'success';
          return raw;
        })()
      : undefined;

  const renderSidebarTaskSection = useCallback(
    (sectionKey: SidebarTaskSectionKey) => {
      const section = TASK_SECTIONS.find((s) => s.key === sectionKey);
      if (!section) return null;

      const expanded = taskSectionExpanded[sectionKey];
      const items = tasksByStatus[sectionKey] ?? [];

      const count =
        sectionKey === 'queued'
          ? taskStats.queued
          : sectionKey === 'processing'
            ? taskStats.processing
            : sectionKey === 'success'
              ? taskStats.success
              : taskStats.failed;

      const viewAllActive = Boolean(activeTasksStatus && activeTasksStatus === section.statusFilter);

      return (
        <div key={sectionKey} className="hc-sider-section">
          <div className="hc-sider-section__header">
            <Button
              type="text"
              className="hc-sider-section__titleBtn"
              // A11y/test note: set an explicit label so the section button doesn't get mixed up with task item buttons.
              aria-label={t(section.labelKey)}
              onClick={() => {
                // UX:
                // - Clicking the section header toggles expand/collapse (so the header behaves like an accordion).
                // - When the sidebar is collapsed, there is no room to render a preview list; use header click to open the full list.
                if (siderCollapsed) {
                  // Navigation rule: treat collapsed-sidebar status header clicks as a sidebar navigation.
                  navigateFromSidebar(buildTasksHash({ status: section.statusFilter }));
                  return;
                }
                setTaskSectionExpanded((prev) => ({
                  ...prev,
                  [sectionKey]: !prev[sectionKey]
                }));
              }}
              // UX note: keep icons on section headers only in collapsed sidebar mode; expanded mode uses item-level icons.
              icon={siderCollapsed ? section.icon : undefined}
            >
              {!siderCollapsed ? (
                <span className="hc-sider-section__title">
                  {/* UX: keep the count right-aligned so users can scan labels quickly across sections. */}
                  <span className="hc-sider-section__label">{t(section.labelKey)}</span>
                  <span className="hc-sider-section__count">{count}</span>
                </span>
              ) : null}
            </Button>
          </div>

          {!siderCollapsed && expanded ? (
            <div className="hc-sider-section__items">
              {items.length ? (
                <>
                  {items.map((task) => (
                    <Button
                      key={task.id}
                      type="text"
                      block
                      // UX: highlight the active task so the sidebar location stays in sync with the content pane.
                      className={`hc-sider-item${activeTaskId === task.id ? ' hc-sider-item--active' : ''}`}
                      aria-current={activeTaskId === task.id ? 'page' : undefined}
                      onClick={() => openTask(task)}
                    >
                      <span className={`hc-sider-item__icon hc-sider-item__icon--${sectionKey}`}>{section.icon}</span>
                      <span className="hc-sider-item__text">{clampText(getTaskTitle(task), 32)}</span>
                    </Button>
                  ))}
                  {count > 3 ? (
                    <Button
                      type="text"
                      block
                      // UX: keep "View all" highlighted while user is on the filtered Tasks page (`#/tasks?status=...`).
                      className={`hc-sider-item hc-sider-item--more${viewAllActive ? ' hc-sider-item--active' : ''}`}
                      aria-current={viewAllActive ? 'page' : undefined}
                    onClick={() => {
                        // Navigation rule: "View all" is a sidebar navigation entry.
                        navigateFromSidebar(buildTasksHash({ status: section.statusFilter }));
                      }}
                    >
                      <span className="hc-sider-item__icon">
                        <UnorderedListOutlined />
                      </span>
                      <span className="hc-sider-item__text">{t('sidebar.tasks.viewAll')}</span>
                    </Button>
                  ) : null}
                </>
              ) : (
                <Typography.Text type="secondary" className="hc-sider-empty">
                  {t('sidebar.tasks.empty')}
                </Typography.Text>
              )}
            </div>
          ) : null}
        </div>
      );
    },
    [
      activeTaskId,
      activeTasksStatus,
      openTask,
      siderCollapsed,
      t,
      taskSectionExpanded,
      taskStats.failed,
      taskStats.processing,
      taskStats.queued,
      taskStats.success,
      tasksByStatus
    ]
  );

  // Route guard: if not logged in, always show Login page to avoid a 401->redirect loop.
  if (authChecking || authEnabled === null) {
    return (
      <div className="hc-login">
        {/* Show a login-shaped skeleton while resolving auth capability. ro3ln7zex8d0wyynfj0m */}
        <LoginCardSkeleton testId="hc-auth-skeleton" ariaLabel={t('common.loading')} />
      </div>
    );
  }

  const loginRequired = authEnabled !== false;
  if (loginRequired && !authToken) {
    return <LoginPage />;
  }

  const chatGroupId = route.page === 'taskGroup' ? route.taskGroupId : undefined;
  const showChatPage = route.page === 'home' || route.page === 'taskGroup';

  // UX/layout note: render the "My panel" trigger inside the reusable PageNav component so it's always
  // vertically centered and aligned to the far right of the header bar.
  const userPanel = (
    <UserPanelPopover
      themePreference={themePreference}
      onThemePreferenceChange={onThemePreferenceChange}
      accentPreset={accentPreset}
      onAccentPresetChange={onAccentPresetChange}
    />
  );

  return (
    <Layout className="hc-shell">
      <Sider
        className="hc-sider"
        width={280}
        collapsedWidth={72}
        collapsed={siderCollapsed}
        trigger={null}
      >
        <div className="hc-sider__inner">
          <div className="hc-sider__top">
            <div className="hc-sider__brandRow">
              <Typography.Text className="hc-sider__brand">{!siderCollapsed ? t('app.brand') : 'H'}</Typography.Text>
              <Button
                type="text"
                size="small"
                icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                aria-label={siderCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
                onClick={() => setSiderCollapsed((v) => !v)}
              />
            </div>

            <Button
              block
              // UX: do not disable the Home entry while the sidebar refreshes; show a subtle spinner instead.
              icon={sidebarLoading ? <LoadingOutlined spin /> : <PlusOutlined />}
              className="hc-sider__primary"
              onClick={() => goHome()}
            >
              {!siderCollapsed ? t('sidebar.newTaskGroup') : null}
            </Button>
          </div>

          <div className="hc-sider__scroll">
            {!siderCollapsed ? (
              <Typography.Text className="hc-sider__sectionLabel">{t('sidebar.section.repos')}</Typography.Text>
            ) : null}
            <div className="hc-sider-nav">
              <Button
                type="text"
                icon={<ProjectOutlined />}
                className={`hc-sider-nav__item${reposActive ? ' hc-sider-nav__item--active' : ''}`}
                onClick={() => goRepos()}
                aria-label={t('sidebar.nav.repos')}
              >
                {!siderCollapsed ? t('sidebar.nav.repos') : null}
              </Button>
            </div>

            {!siderCollapsed ? (
              <Typography.Text className="hc-sider__sectionLabel">{t('sidebar.section.tasks')}</Typography.Text>
            ) : null}
            {renderSidebarTaskSection('queued')}
            {renderSidebarTaskSection('processing')}
            {renderSidebarTaskSection('success')}
            {renderSidebarTaskSection('failed')}

            {!siderCollapsed ? (
              <Typography.Text className="hc-sider__sectionLabel" style={{ marginTop: 16 }}>
                {t('sidebar.section.taskGroups')}
              </Typography.Text>
            ) : null}

            <Menu
              className="hc-sider-menu"
              mode="inline"
              selectedKeys={activeGroupKey ? [activeGroupKey] : []}
              items={groupMenuItems}
              onClick={(info) => {
                // UX: navigate by the menu key directly so a sidebar refresh cannot break clicks.
                openTaskGroup(String(info.key));
              }}
            />
          </div>
        </div>
      </Sider>

      <Content className="hc-content">
        {route.page === 'repos' ? <ReposPage userPanel={userPanel} /> : null}
        {route.page === 'repo' && route.repoId ? <RepoDetailPage repoId={route.repoId} userPanel={userPanel} /> : null}
        {route.page === 'tasks' ? <TasksPage status={route.tasksStatus} userPanel={userPanel} /> : null}
        {/* Pass backend feature toggles to pages that mount log streaming components. 0nazpc53wnvljv5yh7c6 */}
        {route.page === 'task' && route.taskId ? (
          <TaskDetailPage taskId={route.taskId} userPanel={userPanel} taskLogsEnabled={taskLogsEnabled} />
        ) : null}
        {showChatPage ? (
          <TaskGroupChatPage taskGroupId={chatGroupId} userPanel={userPanel} taskLogsEnabled={taskLogsEnabled} />
        ) : null}
      </Content>
    </Layout>
  );
};
