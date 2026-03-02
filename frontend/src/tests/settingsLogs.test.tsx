import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserSettingsSidebar } from '../components/settings/UserSettingsSidebar';
import { setStoredUser } from '../auth';
import { setLocale } from '../i18n';

// Validate admin-only visibility for the settings logs tab. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
describe('UserSettingsSidebar (logs tab)', () => {
  beforeEach(() => {
    setLocale('en-US');
  });

  test('hides logs tab for non-admin users', () => {
    setStoredUser({ id: 'u1', username: 'user', roles: ['member'] });
    render(<UserSettingsSidebar activeTab="account" />);

    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });

  test('shows logs tab for admin users', () => {
    setStoredUser({ id: 'u2', username: 'admin', roles: ['admin'] });
    render(<UserSettingsSidebar activeTab="account" />);

    expect(screen.getByText('Logs')).toBeInTheDocument();
  });
});
