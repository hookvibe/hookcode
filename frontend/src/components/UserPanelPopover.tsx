import { FC } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { useT } from '../i18n';
import { buildSettingsHash } from '../router';

/**
 * UserPanelPopover (now simplified to a navigation trigger):
 * - Business context: trigger button that navigates to the standalone user settings page
 *   at #/settings. All modal-based logic has been moved to UserSettingsPage.
 *
 * Change record:
 * - 2026-01-12: Added for frontend-chat migration.
 * - 2026-03-01: Simplified from 1700-line modal component to lightweight navigation trigger.
 *
 * Simplified to navigation trigger for standalone settings page. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
 */

// Keep same props interface for backward compatibility. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
export interface UserPanelPopoverProps {
  themePreference: 'system' | 'light' | 'dark';
  onThemePreferenceChange: (pref: 'system' | 'light' | 'dark') => void;
}

// Navigate to the standalone settings page instead of opening a modal. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
export const UserPanelPopover: FC<UserPanelPopoverProps> = () => {
  const t = useT();

  const navigateToSettings = () => {
    window.location.hash = buildSettingsHash();
  };

  return (
    <button
      type="button"
      className="hc-user-trigger-btn"
      onClick={navigateToSettings}
      aria-label={t('panel.trigger')}
    >
      <div className="hc-user-avatar-placeholder"><UserOutlined /></div>
      <span className="hc-user-trigger-label">{t('panel.trigger')}</span>
    </button>
  );
};
