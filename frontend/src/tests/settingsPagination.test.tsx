import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SettingsNotificationsPanel } from '../components/settings/SettingsNotificationsPanel';
import { SettingsLogsPanel } from '../components/settings/SettingsLogsPanel';
import { SETTINGS_DATA_TABLE_CLASS_NAME } from '../components/settings/layout';
import { setLocale } from '../i18n';
import * as api from '../api';

// Validate settings tables render pagination controls. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
vi.mock('../api', () => ({
  __esModule: true,
  fetchNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  fetchSystemLogs: vi.fn()
}));

describe('Settings pagination', () => {
  beforeEach(() => {
    setLocale('en-US');
    vi.resetAllMocks();
  });

  // Ensure notifications table shows pagination UI. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
  test('renders pagination for notifications table', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue({
      notifications: [
        {
          id: 'n1',
          userId: 'u1',
          type: 'TASK_SUCCEEDED',
          level: 'info',
          message: 'Hello',
          createdAt: '2026-03-03T00:00:00.000Z'
        }
      ],
      nextCursor: undefined
    });
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue({ updated: 0, readAt: '2026-03-03T00:00:00.000Z' });

    render(<SettingsNotificationsPanel />);

    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    expect(document.querySelector('.ant-pagination')).toBeTruthy();
    expect(document.querySelector(`.${SETTINGS_DATA_TABLE_CLASS_NAME}`)).toBeTruthy();
  });

  // Ensure logs table shows pagination UI. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
  test('renders pagination for logs table', async () => {
    vi.mocked(api.fetchSystemLogs).mockResolvedValue({
      logs: [
        {
          id: 'l1',
          category: 'system',
          level: 'info',
          message: 'Log entry',
          createdAt: '2026-03-03T00:00:00.000Z'
        }
      ],
      nextCursor: undefined
    });

    render(<SettingsLogsPanel />);

    await waitFor(() => expect(api.fetchSystemLogs).toHaveBeenCalled());
    expect(document.querySelector('.ant-pagination')).toBeTruthy();
    expect(document.querySelector(`.${SETTINGS_DATA_TABLE_CLASS_NAME}`)).toBeTruthy();
  });
});
