/**
 * Tests for the simplified UserPanelPopover navigation trigger.
 * After user-panel-page-20260301, UserPanelPopover is a lightweight button that navigates to #/settings.
 * Detailed settings page tests live in userSettingsPage.test.tsx.
 *
 * Rewritten to match simplified navigation trigger. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { UserPanelPopover } from '../components/UserPanelPopover';

const renderPopover = () => {
  return render(
    <AntdApp>
      <UserPanelPopover themePreference="dark" onThemePreferenceChange={() => {}} />
    </AntdApp>
  );
};

describe('UserPanelPopover', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setLocale('en-US');
    window.location.hash = '#/';
  });

  // Verify trigger button renders with accessible label. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
  test('renders a trigger button with accessible label', () => {
    renderPopover();
    const button = screen.getByRole('button', { name: /Panel/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('hc-user-trigger-btn');
  });

  // Verify clicking the trigger navigates to the settings page. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
  test('navigates to settings page on click', async () => {
    const ui = userEvent.setup();
    renderPopover();

    await ui.click(screen.getByRole('button', { name: /Panel/i }));
    expect(window.location.hash).toBe('#/settings');
  });

  // Verify the avatar placeholder icon is rendered. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
  test('renders avatar placeholder and label', () => {
    renderPopover();
    const button = screen.getByRole('button', { name: /Panel/i });
    expect(button.querySelector('.hc-user-avatar-placeholder')).toBeTruthy();
    expect(screen.getByText('Panel')).toBeInTheDocument();
  });
});
