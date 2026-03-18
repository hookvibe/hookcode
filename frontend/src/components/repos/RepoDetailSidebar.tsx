/**
 * RepoDetailSidebar:
 * - Business context: sidebar sub-navigation for the repo detail page. Replaces the global
 *   sidebar with repo-specific navigation items when the user is viewing a repo detail.
 * - Module: Frontend / Repo Detail sub-navigation.
 *
 * Key behavior:
 * - Renders a compact breadcrumb-style back link ("← Repos") at the top.
 * - Shows the repo name with a provider badge and enabled/disabled status dot.
 * - Lists section links (Overview, Basic, Branches, etc.) with active state.
 * - Supports collapse/expand toggle with localStorage persistence.
 *
 * Change record:
 * - 2026-02-28: Created as part of the repo detail sidebar sub-navigation refactor.
 * - 2026-02-28: Improved header UX — compact back breadcrumb, provider badge, status dot.
 * - 2026-03-01: Added collapse/expand toggle button matching global sidebar pattern.
 *
 * Sidebar sub-navigation component for repo detail page. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
 */
import { FC, useState } from 'react';
import {
  AppstoreOutlined,
  ApiOutlined,
  BranchesOutlined,
  FormOutlined,
  GithubOutlined,
  GitlabOutlined,
  KeyOutlined,
  LeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  SettingOutlined,
  SlidersOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  GlobalOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useT } from '../../i18n';
import { buildReposHash, buildRepoHash, type RepoTab, REPO_TABS } from '../../router';
import { navigateFromSidebar } from '../../navHistory';

// LocalStorage key for persisting repo detail sidebar collapsed state. docs/en/developer/plans/repo-sidebar-collapse-20260301/task_plan.md repo-sidebar-collapse-20260301
const REPO_SIDEBAR_COLLAPSED_KEY = 'hookcode-repo-sider-collapsed';

const getStoredRepoSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage?.getItem(REPO_SIDEBAR_COLLAPSED_KEY) ?? '';
  return stored === '1' || stored === 'true';
};

// Sidebar navigation items grouped by category for visual separation. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
interface NavGroup {
  /** Optional i18n label key for the group header; omit for the first (un-headed) group. */
  titleKey?: string;
  items: Array<{ key: RepoTab; icon: React.ReactNode; labelKey: string }>;
}

const REPO_NAV_GROUPS: NavGroup[] = [
  {
    // Primary navigation — no group header
    items: [
      { key: 'overview', icon: <AppstoreOutlined />, labelKey: 'repos.detail.tabs.overview' },
      { key: 'basic', icon: <FormOutlined />, labelKey: 'repos.detail.tabs.basic' },
      { key: 'branches', icon: <BranchesOutlined />, labelKey: 'repos.detail.tabs.branches' },
    ],
  },
  {
    titleKey: 'repos.detail.sidebar.groupIntegration',
    items: [
      { key: 'credentials', icon: <KeyOutlined />, labelKey: 'repos.detail.tabs.credentials' },
      { key: 'env', icon: <SlidersOutlined />, labelKey: 'repos.detail.tabs.env' }, // Add preview env tab entry for repo settings. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
      { key: 'robots', icon: <RobotOutlined />, labelKey: 'repos.detail.tabs.robots' },
      { key: 'automation', icon: <ThunderboltOutlined />, labelKey: 'repos.detail.tabs.automation' },
      { key: 'skills', icon: <ToolOutlined />, labelKey: 'repos.detail.tabs.skills' },
      { key: 'webhooks', icon: <GlobalOutlined />, labelKey: 'repos.detail.tabs.webhooks' },
    ],
  },
  {
    titleKey: 'repos.detail.sidebar.groupManage',
    items: [
      { key: 'members', icon: <TeamOutlined />, labelKey: 'repos.detail.tabs.members' },
      { key: 'costs', icon: <DollarOutlined />, labelKey: 'repos.detail.tabs.costs' },
      { key: 'taskGroupTokens', icon: <ApiOutlined />, labelKey: 'repos.detail.tabs.taskGroupTokens' }, // Add task-group token page entry in the repo sidebar. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
      { key: 'settings', icon: <SettingOutlined />, labelKey: 'repos.detail.tabs.settings' },
    ],
  },
];

export interface RepoDetailSidebarProps {
  repoId: string;
  repoName?: string;
  /** Git provider type for badge rendering. */
  provider?: 'github' | 'gitlab';
  /** Whether the repo is enabled — drives the status dot color. */
  enabled?: boolean;
  activeTab: RepoTab;
  className?: string;
}

// Repo detail sidebar with sub-page navigation and collapse toggle. docs/en/developer/plans/repo-sidebar-collapse-20260301/task_plan.md repo-sidebar-collapse-20260301
export const RepoDetailSidebar: FC<RepoDetailSidebarProps> = ({
  repoId,
  repoName,
  provider,
  enabled = true,
  activeTab,
  className = '',
}) => {
  const t = useT();

  // Persist sidebar collapsed state across page loads via localStorage. docs/en/developer/plans/repo-sidebar-collapse-20260301/task_plan.md repo-sidebar-collapse-20260301
  const [collapsed, setCollapsed] = useState(() => getStoredRepoSidebarCollapsed());

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage?.setItem(REPO_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
  };

  const navigate = (hash: string) => {
    navigateFromSidebar(hash);
  };

  // Render a compact provider icon beside the repo name. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const ProviderIcon = provider === 'github' ? GithubOutlined : provider === 'gitlab' ? GitlabOutlined : null;

  return (
    <nav className={`hc-modern-sidebar hc-repo-detail-sidebar ${collapsed ? 'hc-repo-detail-sidebar--collapsed' : ''} ${className}`}>
      {/* Header with back link and collapse toggle. docs/en/developer/plans/repo-sidebar-collapse-20260301/task_plan.md repo-sidebar-collapse-20260301 */}
      <div className="hc-repo-sidebar-header">
        <button
          className="hc-repo-sidebar-back"
          onClick={() => navigate(buildReposHash())}
          title={t('repos.detail.sidebar.backToRepos')}
        >
          <LeftOutlined />
          {!collapsed && <span>{t('repos.detail.sidebar.backToRepos')}</span>}
        </button>
        {/* Collapse/expand toggle button — mirrors the global sidebar pattern. docs/en/developer/plans/repo-sidebar-collapse-20260301/task_plan.md repo-sidebar-collapse-20260301 */}
        <button
          className="hc-sidebar-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      {/* Repo identity: name + provider badge + status dot */}
      <div className="hc-repo-sidebar-identity">
        <div className="hc-repo-sidebar-identity__name-row">
          {ProviderIcon && (
            <span className="hc-repo-sidebar-identity__provider">
              <ProviderIcon />
            </span>
          )}
          {!collapsed && (
            <span className="hc-repo-sidebar-identity__name" title={repoName || repoId}>
              {repoName || repoId}
            </span>
          )}
        </div>
        <span className={`hc-repo-sidebar-identity__dot ${enabled ? 'hc-repo-sidebar-identity__dot--on' : 'hc-repo-sidebar-identity__dot--off'}`} />
      </div>

      {/* Grouped navigation items with optional section titles */}
      <div className="hc-sidebar-content">
        {REPO_NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="hc-sidebar-section">
            {/* Hide section titles when collapsed — only show icon nav items. docs/en/developer/plans/repo-sidebar-collapse-20260301/task_plan.md repo-sidebar-collapse-20260301 */}
            {group.titleKey && !collapsed && (
              <span className="hc-sidebar-section-title">{t(group.titleKey as any)}</span>
            )}
            {group.items.map((item) => (
              <button
                key={item.key}
                className={`hc-nav-item ${activeTab === item.key ? 'hc-nav-item--active' : ''}`}
                onClick={() => navigate(buildRepoHash(repoId, item.key === 'overview' ? undefined : item.key))}
                title={t(item.labelKey as any)}
              >
                <span className="hc-nav-icon">{item.icon}</span>
                {!collapsed && <span className="hc-nav-label">{t(item.labelKey as any)}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
};
