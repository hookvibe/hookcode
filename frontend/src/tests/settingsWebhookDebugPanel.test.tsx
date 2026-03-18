import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { SettingsWebhookDebugPanel } from '../components/settings/SettingsWebhookDebugPanel';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  __esModule: true,
  listWebhookEvents: vi.fn(),
  fetchWebhookEvent: vi.fn(),
  replayWebhookEvent: vi.fn(),
  replayWebhookEventDryRun: vi.fn(),
  getApiErrorMessage: vi.fn((error: any) => error?.response?.data?.error || error?.message || '')
}));

const renderPanel = () =>
  render(
    <AntdApp>
      <SettingsWebhookDebugPanel />
    </AntdApp>
  );

// Validate the admin webhook debug center can load global events and replay them from detail drill-down. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
describe('SettingsWebhookDebugPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    vi.mocked(api.listWebhookEvents).mockResolvedValue({
      events: [
        {
          id: 'evt-1',
          repoId: 'repo-1',
          provider: 'github',
          eventName: 'push',
          mappedEventType: 'commit',
          result: 'error',
          httpStatus: 500,
          code: 'TASK_FAILED',
          message: 'worker failed',
          errorLayer: 'task_creation',
          matchedRuleIds: ['rule-1'],
          matchedRobotIds: ['robot-1'],
          taskIds: [],
          taskGroupIds: [],
          createdAt: '2026-03-13T00:00:00.000Z'
        }
      ]
    });
    vi.mocked(api.fetchWebhookEvent).mockResolvedValue({
      id: 'evt-1',
      repoId: 'repo-1',
      provider: 'github',
      eventName: 'push',
      mappedEventType: 'commit',
      result: 'error',
      httpStatus: 500,
      code: 'TASK_FAILED',
      message: 'worker failed',
      payloadHash: 'hash-1',
      matchedRuleIds: ['rule-1'],
      matchedRobotIds: ['robot-1'],
      taskIds: [],
      taskGroupIds: [],
      createdAt: '2026-03-13T00:00:00.000Z',
      payload: { foo: 'bar' },
      response: { error: 'worker failed' },
      debugTrace: {
        source: 'ingress',
        provider: 'github',
        steps: [{ key: 'ingress', title: 'Webhook received', status: 'success', at: '2026-03-13T00:00:00.000Z' }]
      }
    } as any);
    vi.mocked(api.replayWebhookEventDryRun).mockResolvedValue({
      id: 'evt-2',
      repoId: 'repo-1',
      provider: 'github',
      eventName: 'push',
      mappedEventType: 'commit',
      result: 'accepted',
      httpStatus: 200,
      matchedRuleIds: ['rule-1'],
      matchedRobotIds: ['robot-1'],
      taskIds: [],
      taskGroupIds: [],
      replayOfEventId: 'evt-1',
      replayMode: 'stored_actions',
      createdAt: '2026-03-13T00:05:00.000Z',
      payload: { foo: 'bar' },
      response: { dryRun: true },
      dryRunResult: { mode: 'stored_actions', results: [] },
      debugTrace: { source: 'replay', provider: 'github', steps: [] }
    } as any);
  });

  test('loads global webhook events and opens detail', async () => {
    renderPanel();

    await waitFor(() => expect(api.listWebhookEvents).toHaveBeenCalled());
    expect(await screen.findByText('repo-1')).toBeInTheDocument();

    const buttons = await screen.findAllByRole('button', { name: 'View' });
    await userEvent.click(buttons[0]);

    await waitFor(() => expect(api.fetchWebhookEvent).toHaveBeenCalledWith('evt-1'));
    expect(await screen.findByText('Debug timeline')).toBeInTheDocument();
    expect(screen.getByText('Webhook received')).toBeInTheDocument();
  });

  test('runs replay dry-run from the admin detail modal', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.listWebhookEvents).toHaveBeenCalled());
    const buttons = await screen.findAllByRole('button', { name: 'View' });
    await ui.click(buttons[0]);
    await waitFor(() => expect(api.fetchWebhookEvent).toHaveBeenCalledWith('evt-1'));

    await ui.click(await screen.findByRole('button', { name: 'Replay dry-run' }));

    await waitFor(() =>
      expect(api.replayWebhookEventDryRun).toHaveBeenCalledWith('evt-1', { mode: 'stored_actions' })
    );
  });
});
