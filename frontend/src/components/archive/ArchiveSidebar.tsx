/**
 * ArchiveSidebar:
 * - Business context: sidebar sub-navigation for the archive page. Replaces the
 *   global sidebar with archive-specific navigation items when the user is viewing archives.
 * - Module: Frontend / Archive sub-navigation.
 *
 * Key behavior:
 * - Renders a compact breadcrumb-style back link ("← Home") at the top.
 * - Shows the archive title with an icon.
 * - Lists section links (Repos, Tasks) with active state.
 * - Supports collapse/expand toggle with localStorage persistence.
 *
 * Change record:
 * - 2026-03-01: Created as part of converting archive page from AntD Tabs to sidebar sub-navigation.
 *
 * Sidebar sub-navigation component for archive page. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
 */
import { FC, useState } from 'react';
import {
  DatabaseOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useT } from '../../i18n';
import { buildHomeHash, buildArchiveHash, type ArchiveTab, ARCHIVE_TABS } from '../../router';
import { navigateFromSidebar } from '../../navHistory';

// LocalStorage key for persisting archive sidebar collapsed state. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
const ARCHIVE_SIDEBAR_COLLAPSED_KEY = 'hookcode-archive-sider-collapsed';

const getStoredArchiveSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage?.getItem(ARCHIVE_SIDEBAR_COLLAPSED_KEY) ?? '';
  return stored === '1' || stored === 'true';
};

// Archive navigation items for the sidebar. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
interface NavGroup {
  titleKey?: string;
  items: Array<{ key: ArchiveTab; icon: React.ReactNode; labelKey: string }>;
}

const ARCHIVE_NAV_GROUPS: NavGroup[] = [
  {
    // Archive sections — repos and tasks
    items: [
      { key: 'repos', icon: <DatabaseOutlined />, labelKey: 'archive.tabs.repos' },
      { key: 'tasks', icon: <UnorderedListOutlined />, labelKey: 'archive.tabs.tasks' },
    ],
  },
];

export interface ArchiveSidebarProps {
  activeTab: ArchiveTab;
  className?: string;
}

// Archive sidebar with sub-page navigation and collapse toggle. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
export const ArchiveSidebar: FC<ArchiveSidebarProps> = ({
  activeTab,
  className = '',
}) => {
  const t = useT();

  // Persist sidebar collapsed state across page loads via localStorage. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  const [collapsed, setCollapsed] = useState(() => getStoredArchiveSidebarCollapsed());

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage?.setItem(ARCHIVE_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
  };

  const navigate = (hash: string) => {
    navigateFromSidebar(hash);
  };

  return (
    <nav className={`hc-modern-sidebar hc-archive-sidebar ${collapsed ? 'hc-archive-sidebar--collapsed' : ''} ${className}`}>
      {/* Header with back link and collapse toggle. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301 */}
      <div className="hc-archive-sidebar-header">
        <button
          className="hc-archive-sidebar-back"
          onClick={() => navigate(buildHomeHash())}
          title={t('common.backToHome')}
        >
          <LeftOutlined />
          {!collapsed && <span>{t('common.backToHome')}</span>}
        </button>
        {/* Collapse/expand toggle button — mirrors the repo/settings sidebar pattern. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301 */}
        <button
          className="hc-sidebar-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      {/* Archive identity: icon + title */}
      <div className="hc-archive-sidebar-identity">
        <div className="hc-archive-sidebar-identity__icon">
          <FolderOpenOutlined />
        </div>
        {!collapsed && (
          <div className="hc-archive-sidebar-identity__info">
            <span className="hc-archive-sidebar-identity__name">{t('archive.page.title')}</span>
            <span className="hc-archive-sidebar-identity__desc">{t('archive.page.subtitle')}</span>
          </div>
        )}
      </div>

      {/* Grouped navigation items */}
      <div className="hc-sidebar-content">
        {ARCHIVE_NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="hc-sidebar-section">
            {group.titleKey && !collapsed && (
              <span className="hc-sidebar-section-title">{t(group.titleKey as any)}</span>
            )}
            {group.items.map((item) => (
              <button
                key={item.key}
                className={`hc-nav-item ${activeTab === item.key ? 'hc-nav-item--active' : ''}`}
                onClick={() => navigate(buildArchiveHash(item.key === 'repos' ? undefined : item.key))}
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
