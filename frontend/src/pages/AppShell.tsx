import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Drawer } from 'antd';
import { fetchAuthMe } from '../api';
import { AUTH_CHANGED_EVENT, getToken } from '../auth';
import { useT } from '../i18n';
import {
  buildHomeHash,
  type RouteState
} from '../router';
import { UserPanelPopover } from '../components/UserPanelPopover';
import { LoginCardSkeleton } from '../components/skeletons/LoginCardSkeleton';
import { ModernSidebar } from '../components/ModernSidebar';
import { LoginPage } from './LoginPage';
import { RepoDetailPage } from './RepoDetailPage';
import { ReposPage } from './ReposPage';
import { TaskDetailPage } from './TaskDetailPage';
import { TaskGroupChatPage } from './TaskGroupChatPage';
import { TaskGroupsPage } from './TaskGroupsPage';
import { TasksPage } from './TasksPage';
import { ArchivePage } from './ArchivePage';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppShellProps {
  route: RouteState;
  themePreference: ThemePreference;
  onThemePreferenceChange: (next: ThemePreference) => void;
}

const SIDEBAR_MOBILE_QUERY = '(max-width: 768px)';

const getInitialMobileLayout = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.(SIDEBAR_MOBILE_QUERY).matches);
};

export const AppShell: FC<AppShellProps> = ({
  route,
  themePreference,
  onThemePreferenceChange
}) => {
  const t = useT();

  const [authToken, setAuthToken] = useState<string | null>(() => getToken());
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [taskLogsEnabled, setTaskLogsEnabled] = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileLayout, setIsMobileLayout] = useState(() => getInitialMobileLayout());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mobileMedia = window.matchMedia(SIDEBAR_MOBILE_QUERY);
    const handleMobileChange = (event: MediaQueryListEvent) => setIsMobileLayout(event.matches);
    setIsMobileLayout(mobileMedia.matches);
    
    if (mobileMedia.addEventListener) {
      mobileMedia.addEventListener('change', handleMobileChange);
      return () => mobileMedia.removeEventListener('change', handleMobileChange);
    }
    mobileMedia.addListener(handleMobileChange);
    return () => mobileMedia.removeListener(handleMobileChange);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      setMobileNavOpen(false);
    }
  }, [isMobileLayout]);

  const refreshAuthState = useCallback(async () => {
    setAuthChecking(true);
    try {
      const me = await fetchAuthMe();
      setAuthEnabled(Boolean(me?.authEnabled));
      setTaskLogsEnabled(Boolean(me?.features?.taskLogsEnabled));
    } catch (err: any) {
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
    if ((authToken || authEnabled === false) && route.page === 'login') {
      window.location.hash = buildHomeHash();
    }
  }, [authEnabled, authToken, route.page]);

  if (authChecking || authEnabled === null) {
    return (
      <div className="hc-login">
        <LoginCardSkeleton testId="hc-auth-skeleton" ariaLabel={t('common.loading')} />
      </div>
    );
  }

  const loginRequired = authEnabled !== false;
  if (loginRequired && !authToken) {
    return <LoginPage />;
  }

  const userPanel = (
    <UserPanelPopover themePreference={themePreference} onThemePreferenceChange={onThemePreferenceChange} />
  );

  const openMobileNav = () => setMobileNavOpen(true);
  const closeMobileNav = () => setMobileNavOpen(false);

  const navToggle = isMobileLayout
    ? {
        ariaLabel: t('common.openMenu'),
        onClick: openMobileNav
      }
    : undefined;

  return (
    <div className="hc-shell-modern">
      {/* Desktop Sidebar */}
      {!isMobileLayout && (
        <ModernSidebar 
          route={route} 
        />
      )}

      {/* Mobile Drawer */}
      {isMobileLayout && (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={closeMobileNav}
          width={280}
          className="hc-sider-drawer"
          title={t('app.brand')}
          styles={{ body: { padding: 0 } }}
        >
          <ModernSidebar 
            route={route} 
            isMobileLayout={true}
            mobileNavOpen={mobileNavOpen}
            onCloseMobileNav={closeMobileNav}
            className="hc-modern-sidebar--mobile"
          />
        </Drawer>
      )}

      {/* Main Content Area */}
      <main className="hc-content-modern">
        {route.page === 'repos' ? <ReposPage userPanel={userPanel} navToggle={navToggle} /> : null}
        {route.page === 'repo' && route.repoId ? (
          <RepoDetailPage repoId={route.repoId} userPanel={userPanel} navToggle={navToggle} />
        ) : null}
        {route.page === 'archive' ? <ArchivePage tab={route.archiveTab} userPanel={userPanel} navToggle={navToggle} /> : null}
        {route.page === 'tasks' ? (
          <TasksPage status={route.tasksStatus} repoId={route.tasksRepoId} userPanel={userPanel} navToggle={navToggle} />
        ) : null}
        {route.page === 'taskGroups' ? <TaskGroupsPage userPanel={userPanel} navToggle={navToggle} /> : null}
        {route.page === 'task' && route.taskId ? (
          <TaskDetailPage taskId={route.taskId} userPanel={userPanel} taskLogsEnabled={taskLogsEnabled} navToggle={navToggle} />
        ) : null}
        {(route.page === 'home' || route.page === 'taskGroup') ? (
          <TaskGroupChatPage
            taskGroupId={route.page === 'taskGroup' ? route.taskGroupId : undefined}
            userPanel={userPanel}
            taskLogsEnabled={taskLogsEnabled}
            navToggle={navToggle}
          />
        ) : null}
      </main>
    </div>
  );
};
