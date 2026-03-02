import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserSettingsSidebar } from '../components/settings/UserSettingsSidebar';
import { setStoredUser } from '../auth';
import { setLocale } from '../i18n';

// Validate notifications tab visibility for all users. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
describe('UserSettingsSidebar (notifications tab)', () => {
  beforeEach(() => {
    setLocale('en-US');
  });

  test('shows notifications tab for non-admin users', () => {
    setStoredUser({ id: 'u1', username: 'user', roles: ['member'] });
    render(<UserSettingsSidebar activeTab="account" />);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  test('shows notifications tab for admin users', () => {
    setStoredUser({ id: 'u2', username: 'admin', roles: ['admin'] });
    render(<UserSettingsSidebar activeTab="account" />);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });
});
