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
import { RegisterPage } from './RegisterPage';
import { VerifyEmailPage } from './VerifyEmailPage';
import { AcceptInvitePage } from './AcceptInvitePage';
import { RepoDetailPage } from './RepoDetailPage';
import { ReposPage } from './ReposPage';
import { TaskDetailPage } from './TaskDetailPage';
import { TaskGroupChatPage } from './TaskGroupChatPage';
import { TaskGroupsPage } from './TaskGroupsPage';
import { TasksPage } from './TasksPage';
import { ArchivePage } from './ArchivePage';
import { SkillsPage } from './SkillsPage';

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
  // Track registration feature flags for auth-related routes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const [registerEnabled, setRegisterEnabled] = useState<boolean | null>(null);
  const [registerRequireEmailVerify, setRegisterRequireEmailVerify] = useState<boolean | null>(null);
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
      setRegisterEnabled(Boolean(me?.features?.registerEnabled));
      setRegisterRequireEmailVerify(Boolean(me?.features?.registerRequireEmailVerify));
    } catch (err: any) {
      const status = err?.response?.status;
      setAuthEnabled(true);
      setTaskLogsEnabled(null);
      // Fall back to disabled registration flags when auth state cannot be loaded. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      setRegisterEnabled(false);
      setRegisterRequireEmailVerify(false);
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
    if ((authToken || authEnabled === false) && (route.page === 'login' || route.page === 'register')) {
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
    if (route.page === 'register') {
      return <RegisterPage registerEnabled={registerEnabled} registerRequireEmailVerify={registerRequireEmailVerify} />;
    }
    if (route.page === 'verifyEmail') {
      return <VerifyEmailPage email={route.verifyEmailEmail} token={route.verifyEmailToken} />;
    }
    if (route.page === 'acceptInvite') {
      return <AcceptInvitePage email={route.inviteEmail} token={route.inviteToken} isAuthenticated={false} />;
    }
    // Route unauthenticated users to login by default, with register flags for UX. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    return <LoginPage registerEnabled={registerEnabled} registerRequireEmailVerify={registerRequireEmailVerify} />;
  }

  // Keep verification flow outside the app shell for a focused auth UX. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  if (route.page === 'verifyEmail') {
    return <VerifyEmailPage email={route.verifyEmailEmail} token={route.verifyEmailToken} />;
  }

  if (route.page === 'acceptInvite') {
    // Render invite acceptance outside the main shell even when authenticated. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    return <AcceptInvitePage email={route.inviteEmail} token={route.inviteToken} isAuthenticated={Boolean(authToken)} />;
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
        {route.page === 'skills' ? (
          <SkillsPage userPanel={userPanel} navToggle={navToggle} />
        ) : null /* Render the skills registry page inside the shell. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
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
