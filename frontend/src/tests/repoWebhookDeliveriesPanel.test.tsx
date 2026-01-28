import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { RepoWebhookDeliveriesPanel } from '../components/repos/RepoWebhookDeliveriesPanel';
import * as api from '../api';

vi.mock('../api', () => {
  return {
    __esModule: true,
    listRepoWebhookDeliveries: vi.fn(async () => ({ deliveries: [], nextCursor: undefined })),
    fetchRepoWebhookDelivery: vi.fn(async () => ({
      id: 'd1',
      repoId: 'r1',
      provider: 'github',
      eventName: 'push',
      result: 'accepted',
      httpStatus: 200,
      code: 'ok',
      message: 'accepted',
      taskIds: ['t1'],
      createdAt: '2026-01-28T00:00:00.000Z',
      payload: { foo: 'bar' },
      response: { status: 'ok' }
    }))
  };
});

const renderPanel = (repoId: string) =>
  render(
    <AntdApp>
      <RepoWebhookDeliveriesPanel repoId={repoId} />
    </AntdApp>
  );

describe('RepoWebhookDeliveriesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
  });

  test('renders JsonViewer for payload and response in the detail modal', async () => {
    // Verify webhook payloads/responses render in the shared JsonViewer tree. docs/en/developer/plans/payloadjsonui20260128/task_plan.md payloadjsonui20260128
    const ui = userEvent.setup();
    vi.mocked(api.listRepoWebhookDeliveries).mockResolvedValueOnce({
      deliveries: [
        {
          id: 'd1',
          repoId: 'r1',
          provider: 'github',
          eventName: 'push',
          result: 'accepted',
          httpStatus: 200,
          code: 'ok',
          message: 'accepted',
          taskIds: ['t1'],
          createdAt: '2026-01-28T00:00:00.000Z'
        }
      ],
      nextCursor: undefined
    });

    renderPanel('r1');

    await waitFor(() => expect(api.listRepoWebhookDeliveries).toHaveBeenCalled());
    await ui.click(await screen.findByRole('button', { name: 'View' }));

    await waitFor(() => expect(api.fetchRepoWebhookDelivery).toHaveBeenCalledWith('r1', 'd1'));
    expect(await screen.findByText('Received payload')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('"bar"')).toBeInTheDocument();
    expect(document.querySelectorAll('.hc-json-viewer').length).toBeGreaterThan(0);
  });
});
