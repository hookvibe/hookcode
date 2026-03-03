import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsPopover } from '../components/notifications/NotificationsPopover';
import { setLocale } from '../i18n';
import * as api from '../api';

// Validate notifications popover read/close behavior. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
vi.mock('../api', () => ({
  __esModule: true,
  fetchNotifications: vi.fn(),
  fetchNotificationsUnreadCount: vi.fn(),
  markAllNotificationsRead: vi.fn()
}));

describe('NotificationsPopover', () => {
  beforeEach(() => {
    setLocale('en-US');
    vi.resetAllMocks();
  });

  // Ensure opening the popover triggers a read-all call. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
  test('marks notifications read when the popover opens', async () => {
    vi.mocked(api.fetchNotificationsUnreadCount).mockResolvedValue({ count: 2 });
    vi.mocked(api.fetchNotifications).mockResolvedValue({ notifications: [], nextCursor: undefined });
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue({ updated: 2, readAt: '2026-03-03T00:00:00.000Z' });

    render(<NotificationsPopover />);

    await waitFor(() => expect(api.fetchNotificationsUnreadCount).toHaveBeenCalled());

    const trigger = await screen.findByRole('button', { name: 'Notifications' });
    await userEvent.setup().click(trigger);

    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalled());
  });

  // Ensure manual mark-all closes the popover after success. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
  test('closes the popover after clicking mark all read', async () => {
    vi.mocked(api.fetchNotificationsUnreadCount).mockResolvedValue({ count: 0 });
    vi.mocked(api.fetchNotifications).mockResolvedValue({ notifications: [], nextCursor: undefined });
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue({ updated: 1, readAt: '2026-03-03T00:00:00.000Z' });

    render(<NotificationsPopover />);

    const trigger = await screen.findByRole('button', { name: 'Notifications' });
    await userEvent.setup().click(trigger);

    await waitFor(() => expect(screen.getByText('View all')).toBeInTheDocument());

    const sources = ((globalThis as any).__eventSourceInstances ?? []) as Array<{ emit: (type: string, ev?: any) => void }>;
    sources[0]?.emit('notification', {
      data: JSON.stringify({
        id: 'n1',
        userId: 'u1',
        type: 'TASK_SUCCEEDED',
        level: 'info',
        message: 'Hello',
        createdAt: '2026-03-03T00:00:00.000Z'
      })
    });

    const markButton = await screen.findByRole('button', { name: 'Mark all read' });
    await waitFor(() => expect(markButton).not.toBeDisabled());
    await userEvent.setup().click(markButton);

    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('View all')).not.toBeInTheDocument());
  });
});
