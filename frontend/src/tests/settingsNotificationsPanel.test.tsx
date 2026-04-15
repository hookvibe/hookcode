import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsNotificationsPanel } from '../components/settings/SettingsNotificationsPanel';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  __esModule: true,
  fetchNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn()
}));

// Verify settings notifications render preserved external URLs as links. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
describe('SettingsNotificationsPanel', () => {
  beforeEach(() => {
    setLocale('en-US');
    vi.resetAllMocks();
  });

  test('renders external notification URLs as anchor links', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue({
      notifications: [
        {
          id: 'n1',
          userId: 'u1',
          type: 'TASK_FAILED',
          level: 'error',
          message: 'Open external comment',
          linkUrl: 'https://example.com/comment/1',
          createdAt: '2026-03-03T00:00:00.000Z'
        }
      ],
      nextCursor: undefined
    });
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue({ updated: 0, readAt: '2026-03-03T00:00:00.000Z' });

    render(<SettingsNotificationsPanel />);

    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    const link = await screen.findByRole('link', { name: 'Open external comment' });
    expect(link).toHaveAttribute('href', 'https://example.com/comment/1');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
