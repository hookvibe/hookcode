/**
 * UserSettingsSidebar:
 * - Business context: sidebar sub-navigation for the user settings page. Replaces the
 *   global sidebar with settings-specific navigation items when the user is viewing settings.
 * - Module: Frontend / User Settings sub-navigation.
 *
 * Key behavior:
 * - Renders a compact breadcrumb-style back link ("← Home") at the top.
 * - Shows the user avatar with display name and role.
 * - Lists section links (Account, Credentials, Tools, Environment, Settings) with active state.
 * - Supports collapse/expand toggle with localStorage persistence.
 * - Includes logout button at the bottom.
 *
 * Change record:
 * - 2026-03-01: Created as part of the user panel page conversion from modal to standalone page.
 *
 * Sidebar sub-navigation component for user settings page. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
 */
import { FC, useState } from 'react';
import {
  CloudServerOutlined,
  GlobalOutlined,
  KeyOutlined,
  LeftOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  UserOutlined,
  FileTextOutlined,
  BellOutlined,
  EyeOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { useT } from '../../i18n';
import { buildHomeHash, buildSettingsHash, type SettingsTab } from '../../router';
import { navigateFromSidebar } from '../../navHistory';
import { clearAuth, getStoredUser, getToken } from '../../auth';
import { getStoredSettingsSidebarCollapsed, SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY } from './layout';

// Settings navigation items grouped by category for visual separation. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
interface NavGroup {
  /** Optional i18n label key for the group header; omit for the first (un-headed) group. */
  titleKey?: string;
  items: Array<{ key: SettingsTab; icon: React.ReactNode; labelKey: string }>;
}

const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    // Account group — no header for first group
    titleKey: 'panel.nav.group.account',
    items: [
      { key: 'account', icon: <UserOutlined />, labelKey: 'panel.tabs.account' },
    ],
  },
  {
    titleKey: 'panel.nav.group.integrations',
    items: [
      { key: 'credentials', icon: <KeyOutlined />, labelKey: 'panel.tabs.credentials' },
      { key: 'tools', icon: <CloudServerOutlined />, labelKey: 'panel.tabs.tools' },
      { key: 'environment', icon: <GlobalOutlined />, labelKey: 'panel.tabs.environment' },
    ],
  },
  {
    titleKey: 'panel.nav.group.preferences',
    items: [
      // Add notifications tab next to logs in settings navigation. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      { key: 'notifications', icon: <BellOutlined />, labelKey: 'panel.tabs.notifications' },
      // Add preview management navigation for admin users in settings. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
      { key: 'preview', icon: <EyeOutlined />, labelKey: 'panel.tabs.preview' },
      // Add a worker registry entry in admin settings so runtime bootstrap stays discoverable. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      { key: 'workers', icon: <DeploymentUnitOutlined />, labelKey: 'panel.tabs.workers' },
      { key: 'logs', icon: <FileTextOutlined />, labelKey: 'panel.tabs.logs' },
      { key: 'settings', icon: <SettingOutlined />, labelKey: 'panel.tabs.settings' },
    ],
  },
];

export interface UserSettingsSidebarProps {
  activeTab: SettingsTab;
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (nextCollapsed: boolean) => void;
}

// User settings sidebar with sub-page navigation and collapse toggle. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
export const UserSettingsSidebar: FC<UserSettingsSidebarProps> = ({
  activeTab,
  className = '',
  collapsed,
  onCollapsedChange,
}) => {
  const t = useT();
  const user = getStoredUser();
  const canLogout = Boolean(getToken());

  // Keep the sidebar collapse state controllable so the settings page shell can size breakout tables against the real sidebar width. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312
  const [internalCollapsed, setInternalCollapsed] = useState(() => getStoredSettingsSidebarCollapsed());
  const resolvedCollapsed = collapsed ?? internalCollapsed;

  const toggleCollapsed = () => {
    const next = !resolvedCollapsed;
    if (collapsed === undefined) setInternalCollapsed(next);
    onCollapsedChange?.(next);
    window.localStorage?.setItem(SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
  };

  const navigate = (hash: string) => {
    navigateFromSidebar(hash);
  };

  const logout = () => {
    clearAuth();
    window.location.hash = buildHomeHash();
  };

  // Derive user display strings. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
  const displayName = user?.displayName || user?.username || t('panel.anonymous');
  const isAdmin = Boolean(user?.roles?.includes('admin'));
  const roleText = isAdmin ? t('panel.role.admin') : t('panel.role.user');

  return (
    <nav className={`hc-modern-sidebar hc-settings-sidebar ${resolvedCollapsed ? 'hc-settings-sidebar--collapsed' : ''} ${className}`}>
      {/* Header with back link and collapse toggle. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301 */}
      <div className="hc-settings-sidebar-header">
        <button
          className="hc-settings-sidebar-back"
          onClick={() => navigate(buildHomeHash())}
          title={t('common.backToHome')}
        >
          <LeftOutlined />
          {!resolvedCollapsed && <span>{t('common.backToHome')}</span>}
        </button>
        {/* Collapse/expand toggle button — mirrors the repo sidebar pattern. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301 */}
        <button
          className="hc-sidebar-toggle"
          onClick={toggleCollapsed}
          title={resolvedCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        >
          {resolvedCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      {/* User identity: avatar + name + role */}
      <div className="hc-settings-sidebar-identity">
        <div className="hc-settings-sidebar-avatar">
          <UserOutlined />
        </div>
        {!resolvedCollapsed && (
          <div className="hc-settings-sidebar-identity__info">
            <span className="hc-settings-sidebar-identity__name" title={displayName}>
              {displayName}
            </span>
            <span className="hc-settings-sidebar-identity__role">{roleText}</span>
          </div>
        )}
      </div>

      {/* Grouped navigation items with optional section titles */}
      <div className="hc-sidebar-content">
        {SETTINGS_NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="hc-sidebar-section">
            {/* Hide section titles when collapsed — only show icon nav items. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301 */}
            {group.titleKey && !resolvedCollapsed && (
              <span className="hc-sidebar-section-title">{t(group.titleKey as any)}</span>
            )}
            {group.items.map((item) => {
              // Hide admin-only preview/log navigation for non-admin users. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
              if ((item.key === 'logs' || item.key === 'preview' || item.key === 'workers') && !isAdmin) return null;
              return (
              <button
                key={item.key}
                className={`hc-nav-item ${activeTab === item.key ? 'hc-nav-item--active' : ''}`}
                onClick={() => navigate(buildSettingsHash(item.key === 'account' ? undefined : item.key))}
                title={t(item.labelKey as any)}
              >
                <span className="hc-nav-icon">{item.icon}</span>
                {!resolvedCollapsed && <span className="hc-nav-label">{t(item.labelKey as any)}</span>}
              </button>
              );
            })}
          </div>
        ))}

        {/* Logout button at the bottom of the sidebar. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301 */}
        <div className="hc-sidebar-section hc-settings-sidebar-logout">
          <button
            className="hc-nav-item hc-nav-item--danger"
            onClick={logout}
            disabled={!canLogout}
            title={t('panel.logout.ok')}
          >
            <span className="hc-nav-icon"><LogoutOutlined /></span>
            {!resolvedCollapsed && <span className="hc-nav-label">{t('panel.logout.ok')}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
};
