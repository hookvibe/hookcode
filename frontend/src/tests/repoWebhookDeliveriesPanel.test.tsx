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

const renderPanel = (repoId: string, deliveries: any[] = []) =>
  render(
    <AntdApp>
      {/* Supply delivery data via props to mirror shared dashboard data flow. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128 */}
      <RepoWebhookDeliveriesPanel
        repoId={repoId}
        deliveries={deliveries}
        loading={false}
        loadFailed={false}
        onRefresh={() => undefined}
      />
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
    renderPanel('r1', [
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
    ]);

    await ui.click(await screen.findByRole('button', { name: 'View' }));

    // Assert detail fetch is triggered from the view action now that deliveries are provided by parent. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    await waitFor(() => expect(api.fetchRepoWebhookDelivery).toHaveBeenCalledWith('r1', 'd1'));
    expect(await screen.findByText('Received payload')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('"bar"')).toBeInTheDocument();
    expect(document.querySelectorAll('.hc-json-viewer').length).toBeGreaterThan(0);
  });
});
