import type { SettingsTab } from '../../router';

// Centralize settings table layout flags so wide tabs stay consistent across page rendering and tests. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312
export const SETTINGS_WIDE_TABLE_TABS: readonly SettingsTab[] = ['notifications', 'workers', 'logs'];
export const SETTINGS_DEFAULT_PANEL_SECTION_CLASS_NAME = 'hc-panel-section';
export const SETTINGS_BREAKOUT_PANEL_SECTION_CLASS_NAME = 'hc-panel-section hc-panel-section--table-breakout';
export const SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY = 'hookcode-settings-sider-collapsed';
export const SETTINGS_SIDEBAR_EXPANDED_WIDTH = 240;
export const SETTINGS_SIDEBAR_COLLAPSED_WIDTH = 72;

export const isWideSettingsTableTab = (tab: SettingsTab): boolean => SETTINGS_WIDE_TABLE_TABS.includes(tab);
export const getSettingsPanelSectionClassName = (tab: SettingsTab): string =>
  isWideSettingsTableTab(tab) ? SETTINGS_BREAKOUT_PANEL_SECTION_CLASS_NAME : SETTINGS_DEFAULT_PANEL_SECTION_CLASS_NAME;

// Reuse the persisted settings sidebar state so page-level breakout width logic matches the visible sidebar width. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312
export const getStoredSettingsSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage?.getItem(SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY) ?? '';
  return stored === '1' || stored === 'true';
};

export const SETTINGS_DATA_TABLE_SCROLL_X = 1180;
export const SETTINGS_DATA_TABLE_CLASS_NAME = 'hc-settings-data-table';
export const SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME = `${SETTINGS_DATA_TABLE_CLASS_NAME} ${SETTINGS_DATA_TABLE_CLASS_NAME}--sticky-actions`;
