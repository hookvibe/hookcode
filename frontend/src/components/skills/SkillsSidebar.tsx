/**
 * SkillsSidebar:
 * - Business context: sidebar sub-navigation for the skills marketplace page. Replaces the
 *   global sidebar with skills-specific navigation items when the user is viewing skills.
 * - Module: Frontend / Skills sub-navigation.
 *
 * Key behavior:
 * - Renders a compact breadcrumb-style back link ("← Home") at the top.
 * - Shows the skills title with an icon.
 * - Lists section links (Overview, Built-in, Extra) with active state.
 * - Supports collapse/expand toggle with localStorage persistence.
 *
 * Change record:
 * - 2026-03-01: Created as part of converting skills page to sidebar sub-navigation layout.
 *
 * Sidebar sub-navigation component for skills marketplace page. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
 */
import { FC, useState } from 'react';
import {
  AppstoreOutlined,
  LeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ToolOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useT } from '../../i18n';
import { buildHomeHash, buildSkillsHash, type SkillsTab, SKILLS_TABS } from '../../router';
import { navigateFromSidebar } from '../../navHistory';

// LocalStorage key for persisting skills sidebar collapsed state. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
const SKILLS_SIDEBAR_COLLAPSED_KEY = 'hookcode-skills-sider-collapsed';

const getStoredSkillsSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage?.getItem(SKILLS_SIDEBAR_COLLAPSED_KEY) ?? '';
  return stored === '1' || stored === 'true';
};

// Skills navigation items grouped by category. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
interface NavGroup {
  titleKey?: string;
  items: Array<{ key: SkillsTab; icon: React.ReactNode; labelKey: string }>;
}

const SKILLS_NAV_GROUPS: NavGroup[] = [
  {
    // Main navigation — overview and skill categories
    items: [
      { key: 'overview', icon: <AppstoreOutlined />, labelKey: 'skills.sidebar.overview' },
    ],
  },
  {
    titleKey: 'skills.sidebar.group.registry',
    items: [
      { key: 'built-in', icon: <ToolOutlined />, labelKey: 'skills.sidebar.builtIn' },
      { key: 'extra', icon: <UploadOutlined />, labelKey: 'skills.sidebar.extra' },
    ],
  },
];

export interface SkillsSidebarProps {
  activeTab: SkillsTab;
  className?: string;
}

// Skills sidebar with sub-page navigation and collapse toggle. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
export const SkillsSidebar: FC<SkillsSidebarProps> = ({
  activeTab,
  className = '',
}) => {
  const t = useT();

  // Persist sidebar collapsed state across page loads via localStorage. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  const [collapsed, setCollapsed] = useState(() => getStoredSkillsSidebarCollapsed());

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage?.setItem(SKILLS_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
  };

  const navigate = (hash: string) => {
    navigateFromSidebar(hash);
  };

  return (
    <nav className={`hc-modern-sidebar hc-skills-sidebar ${collapsed ? 'hc-skills-sidebar--collapsed' : ''} ${className}`}>
      {/* Header with back link and collapse toggle. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301 */}
      <div className="hc-skills-sidebar-header">
        <button
          className="hc-skills-sidebar-back"
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

      {/* Skills identity: icon + title */}
      <div className="hc-skills-sidebar-identity">
        <div className="hc-skills-sidebar-identity__icon">
          <ToolOutlined />
        </div>
        {!collapsed && (
          <div className="hc-skills-sidebar-identity__info">
            <span className="hc-skills-sidebar-identity__name">{t('skills.page.title')}</span>
            <span className="hc-skills-sidebar-identity__desc">{t('skills.sidebar.desc')}</span>
          </div>
        )}
      </div>

      {/* Grouped navigation items */}
      <div className="hc-sidebar-content">
        {SKILLS_NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="hc-sidebar-section">
            {group.titleKey && !collapsed && (
              <span className="hc-sidebar-section-title">{t(group.titleKey as any)}</span>
            )}
            {group.items.map((item) => (
              <button
                key={item.key}
                className={`hc-nav-item ${activeTab === item.key ? 'hc-nav-item--active' : ''}`}
                onClick={() => navigate(buildSkillsHash(item.key === 'overview' ? undefined : item.key))}
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
