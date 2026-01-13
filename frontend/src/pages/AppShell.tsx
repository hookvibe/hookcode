import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Empty, Layout, Menu, Space, Typography } from 'antd';
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
import { fetchAuthMe, fetchTaskGroups, fetchTaskStats, fetchTasks } from '../api';
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
import type { AccentPreset } from '../theme/accent';
import { UserPanelPopover } from '../components/UserPanelPopover';
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

export const AppShell: FC<AppShellProps> = ({
  route,
  themePreference,
  onThemePreferenceChange,
  accentPreset,
  onAccentPresetChange
}) => {
  const t = useT();
  const taskSectionAutoInitRef = useRef(false);

  const [authToken, setAuthToken] = useState<string | null>(() => getToken());
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
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

  const refreshAuthState = useCallback(async () => {
    setAuthChecking(true);
    try {
      const me = await fetchAuthMe();
      setAuthEnabled(Boolean(me?.authEnabled));
    } catch (err: any) {
      // When auth is enabled but token is missing/invalid, `/auth/me` returns 401.
      const status = err?.response?.status;
      setAuthEnabled(true);
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

  const refreshSidebar = useCallback(async () => {
    // Business intent: support "auth disabled" environments (no login required) while keeping login guards for normal deployments.
    const canQuery = authEnabled === false || Boolean(authToken);
    if (!canQuery) {
      setTaskStats({ total: 0, queued: 0, processing: 0, success: 0, failed: 0 });
      setTasksByStatus(defaultTasksByStatus);
      setTaskGroups([]);
      // UX: reset the auto-init state so the next successful refresh can apply the "empty sections collapsed" default again.
      taskSectionAutoInitRef.current = false;
      return;
    }

    setSidebarLoading(true);
    try {
      const [stats, queued, processing, success, failed, groups] = await Promise.all([
        fetchTaskStats(),
        fetchTasks({ status: 'queued', limit: 3 }),
        fetchTasks({ status: 'processing', limit: 3 }),
        fetchTasks({ status: 'success', limit: 3 }),
        fetchTasks({ status: 'failed', limit: 3 }),
        fetchTaskGroups({ limit: 50 })
      ]);
      setTaskStats(stats);
      setTasksByStatus({
        queued: queued.slice(0, 3),
        processing: processing.slice(0, 3),
        success: success.slice(0, 3),
        failed: failed.slice(0, 3)
      });
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
    } catch (err) {
      console.error(err);
      // Sidebar errors should not block the whole app; keep last known values.
    } finally {
      setSidebarLoading(false);
    }
  }, [authEnabled, authToken]);

  useEffect(() => {
    void refreshSidebar();
    const timer = window.setInterval(() => void refreshSidebar(), 10_000);
    return () => window.clearInterval(timer);
  }, [refreshSidebar]);

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
        <Empty description={t('common.loading')} />
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
        {route.page === 'task' && route.taskId ? <TaskDetailPage taskId={route.taskId} userPanel={userPanel} /> : null}
        {showChatPage ? <TaskGroupChatPage taskGroupId={chatGroupId} userPanel={userPanel} /> : null}
      </Content>
    </Layout>
  );
};
