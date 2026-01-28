import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Layout, Menu, Space, Tooltip, Typography } from 'antd';
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
  CaretRightOutlined,
  InboxOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Task, TaskGroup, TaskStatusStats } from '../api';
import { fetchAuthMe, fetchDashboardSidebar } from '../api';
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
  type RouteState
} from '../router';
import { navigateFromSidebar } from '../navHistory';
import { clampText, getTaskSidebarPrimaryText, getTaskSidebarSecondaryText, getTaskTitle } from '../utils/task';
import { createAuthedEventSource } from '../utils/sse';
import type { AccentPreset } from '../theme/accent';
import { UserPanelPopover } from '../components/UserPanelPopover';
import { LoginCardSkeleton } from '../components/skeletons/LoginCardSkeleton';
import { LoginPage } from './LoginPage';
import { RepoDetailPage } from './RepoDetailPage';
import { ReposPage } from './ReposPage';
import { TaskDetailPage } from './TaskDetailPage';
import { TaskGroupChatPage } from './TaskGroupChatPage';
import { TaskGroupsPage } from './TaskGroupsPage';
import { TasksPage } from './TasksPage';
import { ArchivePage } from './ArchivePage';

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

const SIDER_COLLAPSED_STORAGE_KEY = 'hookcode-sider-collapsed';

const getInitialSiderCollapsed = (): boolean => {
  // Persist sidebar collapsed preference in localStorage across refresh. l7pvyrepxb0mx2ipdh2y
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage?.getItem(SIDER_COLLAPSED_STORAGE_KEY) ?? '';
  if (stored === '1' || stored === 'true') return true;
  if (stored === '0' || stored === 'false') return false;
  return false;
};

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
  const [siderCollapsed, setSiderCollapsed] = useState(() => getInitialSiderCollapsed()); // Initialize from localStorage to keep collapsed state across refresh. l7pvyrepxb0mx2ipdh2y
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Persist siderCollapsed updates so refresh keeps the user's sidebar preference. l7pvyrepxb0mx2ipdh2y
    window.localStorage?.setItem(SIDER_COLLAPSED_STORAGE_KEY, siderCollapsed ? '1' : '0');
  }, [siderCollapsed]);

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
          // - Apply once, when recent tasks first appear (do not lock the initializer when there are no recent tasks yet). mks8pr4r3m1fo9oqx9av
          if (taskSectionAutoInitRef.current) return prev;
          const now = Date.now();
          const recentWindowMs = 24 * 60 * 60 * 1000;
          const isRecent = (task: Task): boolean => {
            const updatedMs = new Date(task.updatedAt).getTime();
            const createdMs = new Date(task.createdAt).getTime();
            const ts = Number.isFinite(updatedMs) ? updatedMs : createdMs;
            // Be tolerant of malformed timestamps (e.g. non-ISO strings) so recent tasks still auto-expand. mks8pr4r3m1fo9oqx9av
            if (!Number.isFinite(ts)) return true;
            // Note: use absolute delta to tolerate minor server/client clock skew.
            return Math.abs(now - ts) <= recentWindowMs;
          };
          const hasRecentTasks = (list: Task[]): boolean => list.some(isRecent);
          const next = {
            queued: hasRecentTasks(queued),
            processing: hasRecentTasks(processing),
            success: hasRecentTasks(success),
            failed: hasRecentTasks(failed)
          };
          const shouldAutoExpand = Object.values(next).some(Boolean);
          if (!shouldAutoExpand) return prev;
          taskSectionAutoInitRef.current = true;
          return next;
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

  const goArchive = useCallback(() => {
    // Navigation rule: sidebar navigation (archive) resets the header-back chain. qnp1mtxhzikhbi0xspbc
    navigateFromSidebar(buildArchiveHash());
  }, []);

  const goTaskGroups = useCallback(() => {
    // Navigation rule: taskgroup list entry should reset the header-back chain. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    navigateFromSidebar(buildTaskGroupsHash());
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
  const taskGroupsListActive = route.page === 'taskGroups';
  const reposActive = route.page === 'repos' || route.page === 'repo';
  const archiveActive = route.page === 'archive';
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

      // Highlight the active task status on the section header instead of the View All row. docs/en/developer/plans/sidebarviewall20260128/task_plan.md sidebarviewall20260128
      const sectionActive = Boolean(activeTasksStatus && activeTasksStatus === section.statusFilter);
      const headerIcon =
        !siderCollapsed
          ? undefined
          : sectionKey === 'processing' && count === 0
            ? // Disable the Processing spinner when there are no processing tasks in collapsed sidebar mode. l7pvyrepxb0mx2ipdh2y
              <LoadingOutlined className="hc-sider-processingIcon--idle" />
            : section.icon;

      return (
        <div key={sectionKey} className={`hc-sider-section${sectionActive ? ' hc-sider-section--active' : ''}`}>
          <div className="hc-sider-section__header">
            <Button
              type="text"
              className="hc-sider-section__titleBtn"
              // A11y/test note: set an explicit label so the section button doesn't get mixed up with task item buttons.
              aria-label={t(section.labelKey)}
              aria-current={sectionActive ? 'page' : undefined}
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
              icon={headerIcon}
            >
              {!siderCollapsed ? (
                <span className="hc-sider-section__title">
                  <span className="hc-sider-section__label">{t(section.labelKey)}</span>
                </span>
              ) : null}
            </Button>

            {!siderCollapsed ? (
              <>
                <span className="hc-sider-section__count">{count}</span>
                <Button
                  type="text"
                  className="hc-sider-section__navBtn"
                  // Hover UX: replace the count with a nav arrow that routes to the filtered Tasks list. kwq0evw438cxawea0lcj
                  aria-label={`${t('sidebar.tasks.viewAll')} ${t(section.labelKey)}`}
                  icon={<CaretRightOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Navigation rule: treat status header nav clicks as sidebar navigation (clears back chain). kwq0evw438cxawea0lcj
                    navigateFromSidebar(buildTasksHash({ status: section.statusFilter }));
                  }}
                />
              </>
            ) : null}
          </div>

          {!siderCollapsed && expanded ? (
            <div className="hc-sider-section__items">
              {items.length ? (
                <>
                  {items.map((task) => (
                    <Tooltip
                      key={task.id}
                      placement="right"
                      // Hover UX: show the full task title without widening the sidebar. kwq0evw438cxawea0lcj
                      title={getTaskTitle(task)}
                      mouseEnterDelay={0}
                    >
                      <Button
                        type="text"
                        block
                        // UX: highlight the active task so the sidebar location stays in sync with the content pane.
                        className={`hc-sider-item hc-sider-taskItem${activeTaskId === task.id ? ' hc-sider-item--active' : ''}`}
                        aria-current={activeTaskId === task.id ? 'page' : undefined}
                        onClick={() => openTask(task)}
                      >
                        <span className={`hc-sider-item__icon hc-sider-item__icon--${sectionKey}`}>{section.icon}</span>
                        {/* Render 2-line task labels (event+marker, then repo) to surface more context in the sidebar. mks8pr4r3m1fo9oqx9av */}
                        <span className="hc-sider-item__content">
                          <span className="hc-sider-item__title">
                            {clampText(getTaskSidebarPrimaryText(t, task), 44)}
                          </span>
                          <span className="hc-sider-item__meta">{clampText(getTaskSidebarSecondaryText(task), 44)}</span>
                        </span>
                      </Button>
                    </Tooltip>
                  ))}
                  {count > 3 ? (
                    <Button
                      type="text"
                      block
                      // Redesign the View All button as a compact CTA row with a trailing arrow. docs/en/developer/plans/sidebarviewall20260128/task_plan.md sidebarviewall20260128
                      className="hc-sider-item hc-sider-item--more hc-sider-item--viewAll"
                      onClick={() => {
                        // Navigation rule: "View all" is a sidebar navigation entry.
                        navigateFromSidebar(buildTasksHash({ status: section.statusFilter }));
                      }}
                    >
                      <span className="hc-sider-item__text">{t('sidebar.tasks.viewAll')}</span>
                      <span className="hc-sider-item__suffix" aria-hidden="true">
                        <RightOutlined />
                      </span>
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
            <div className={`hc-sider__brandRow${siderCollapsed ? ' hc-sider__brandRow--collapsed' : ''}`}>
              {/* Hide the collapsed brand label so only the sidebar toggle remains. l7pvyrepxb0mx2ipdh2y */}
              {!siderCollapsed ? <Typography.Text className="hc-sider__brand">{t('app.brand')}</Typography.Text> : null}
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

            {/* Separate repos from task statuses in both expanded/collapsed sidebar modes. docs/en/developer/plans/sidebarviewall20260128/task_plan.md sidebarviewall20260128 */}
            <div className="hc-sider__divider" aria-hidden="true" />

            {!siderCollapsed ? (
              <Typography.Text className="hc-sider__sectionLabel">{t('sidebar.section.tasks')}</Typography.Text>
            ) : null}
            {renderSidebarTaskSection('queued')}
            {renderSidebarTaskSection('processing')}
            {renderSidebarTaskSection('success')}
            {renderSidebarTaskSection('failed')}

            {/* Separate task statuses from task groups in both expanded/collapsed sidebar modes. docs/en/developer/plans/sidebarviewall20260128/task_plan.md sidebarviewall20260128 */}
            <div className="hc-sider__divider" aria-hidden="true" />

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
            {/* Add a taskgroup list CTA below the menu so the card list is reachable from the taskgroup area. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
            <Tooltip title={siderCollapsed ? t('taskGroups.page.viewAll') : undefined}>
              <Button
                type="text"
                block
                className={`hc-sider-item hc-sider-item--more hc-sider-item--viewAll${taskGroupsListActive ? ' hc-sider-item--active' : ''}`}
                aria-current={taskGroupsListActive ? 'page' : undefined}
                icon={siderCollapsed ? <UnorderedListOutlined /> : undefined}
                onClick={() => goTaskGroups()}
              >
                {!siderCollapsed ? t('taskGroups.page.viewAll') : null}
              </Button>
            </Tooltip>
          </div>

          <div className="hc-sider__bottom">
            <Tooltip title={t('sidebar.nav.archive')}>
              <Button
                type="text"
                icon={<InboxOutlined />}
                className={`hc-sider-bottom__item${archiveActive ? ' hc-sider-bottom__item--active' : ''}`}
                onClick={() => goArchive()}
                aria-label={t('sidebar.nav.archive')}
              />
            </Tooltip>
          </div>
        </div>
      </Sider>

      <Content className="hc-content">
        {route.page === 'repos' ? <ReposPage userPanel={userPanel} /> : null}
        {route.page === 'repo' && route.repoId ? <RepoDetailPage repoId={route.repoId} userPanel={userPanel} /> : null}
        {route.page === 'archive' ? <ArchivePage tab={route.archiveTab} userPanel={userPanel} /> : null}
        {/* Pass repoId query to TasksPage so repo dashboards can deep-link into scoped task lists. aw85xyfsp5zfg6ihq3jr */}
        {route.page === 'tasks' ? <TasksPage status={route.tasksStatus} repoId={route.tasksRepoId} userPanel={userPanel} /> : null}
        {/* Route the task group list to a card-first page for quick browsing. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
        {route.page === 'taskGroups' ? <TaskGroupsPage userPanel={userPanel} /> : null}
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
