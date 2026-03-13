import { beforeEach, describe, expect, test } from 'vitest';
import {
  getSettingsPanelSectionClassName,
  getStoredSettingsSidebarCollapsed,
  isWideSettingsTableTab,
  SETTINGS_BREAKOUT_PANEL_SECTION_CLASS_NAME,
  SETTINGS_DEFAULT_PANEL_SECTION_CLASS_NAME,
  SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY
} from '../components/settings/layout';

// Keep wide-table tab selection centralized so only data-heavy settings views bypass the shared page-width behavior. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312
describe('settings layout helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('marks notifications, workers, and logs tabs as wide-table views', () => {
    expect(isWideSettingsTableTab('notifications')).toBe(true);
    expect(isWideSettingsTableTab('workers')).toBe(true);
    expect(isWideSettingsTableTab('logs')).toBe(true);
    expect(isWideSettingsTableTab('account')).toBe(false);
  });

  test('uses breakout panel sections only for the table-heavy settings tabs', () => {
    expect(getSettingsPanelSectionClassName('notifications')).toBe(SETTINGS_BREAKOUT_PANEL_SECTION_CLASS_NAME);
    expect(getSettingsPanelSectionClassName('workers')).toBe(SETTINGS_BREAKOUT_PANEL_SECTION_CLASS_NAME);
    expect(getSettingsPanelSectionClassName('logs')).toBe(SETTINGS_BREAKOUT_PANEL_SECTION_CLASS_NAME);
    expect(getSettingsPanelSectionClassName('account')).toBe(SETTINGS_DEFAULT_PANEL_SECTION_CLASS_NAME);
  });

  test('reads the persisted settings sidebar collapse state', () => {
    expect(getStoredSettingsSidebarCollapsed()).toBe(false);
    window.localStorage.setItem(SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY, '1');
    expect(getStoredSettingsSidebarCollapsed()).toBe(true);
  });
});
