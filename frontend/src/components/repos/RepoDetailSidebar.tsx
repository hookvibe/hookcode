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
 *
 * Change record:
 * - 2026-02-28: Created as part of the repo detail sidebar sub-navigation refactor.
 * - 2026-02-28: Improved header UX — compact back breadcrumb, provider badge, status dot.
 *
 * Sidebar sub-navigation component for repo detail page. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
 */
import { FC } from 'react';
import {
  AppstoreOutlined,
  BranchesOutlined,
  FormOutlined,
  GithubOutlined,
  GitlabOutlined,
  KeyOutlined,
  LeftOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useT } from '../../i18n';
import { buildReposHash, buildRepoHash, type RepoTab, REPO_TABS } from '../../router';
import { navigateFromSidebar } from '../../navHistory';

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

// Repo detail sidebar with sub-page navigation. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
export const RepoDetailSidebar: FC<RepoDetailSidebarProps> = ({
  repoId,
  repoName,
  provider,
  enabled = true,
  activeTab,
  className = '',
}) => {
  const t = useT();

  const navigate = (hash: string) => {
    navigateFromSidebar(hash);
  };

  // Render a compact provider icon beside the repo name. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const ProviderIcon = provider === 'github' ? GithubOutlined : provider === 'gitlab' ? GitlabOutlined : null;

  return (
    <nav className={`hc-modern-sidebar hc-repo-detail-sidebar ${className}`}>
      {/* Compact breadcrumb-style back link — small and unobtrusive. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228 */}
      <div className="hc-repo-sidebar-header">
        <button
          className="hc-repo-sidebar-back"
          onClick={() => navigate(buildReposHash())}
          title={t('repos.detail.sidebar.backToRepos')}
        >
          <LeftOutlined />
          <span>{t('repos.detail.sidebar.backToRepos')}</span>
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
          <span className="hc-repo-sidebar-identity__name" title={repoName || repoId}>
            {repoName || repoId}
          </span>
        </div>
        <span className={`hc-repo-sidebar-identity__dot ${enabled ? 'hc-repo-sidebar-identity__dot--on' : 'hc-repo-sidebar-identity__dot--off'}`} />
      </div>

      {/* Grouped navigation items with optional section titles */}
      <div className="hc-sidebar-content">
        {REPO_NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="hc-sidebar-section">
            {group.titleKey && (
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
                <span className="hc-nav-label">{t(item.labelKey as any)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
};
