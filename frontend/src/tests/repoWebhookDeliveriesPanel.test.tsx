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
      mappedEventType: 'commit',
      result: 'accepted',
      httpStatus: 200,
      code: 'ok',
      message: 'accepted',
      payloadHash: 'hash-1',
      signatureVerified: true,
      matchedRuleIds: ['rule-1'],
      matchedRobotIds: ['robot-1'],
      taskIds: ['t1'],
      taskGroupIds: ['g1'],
      createdAt: '2026-01-28T00:00:00.000Z',
      payload: { foo: 'bar' },
      response: { status: 'ok' },
      debugTrace: {
        source: 'ingress',
        provider: 'github',
        steps: [
          { key: 'ingress', title: 'Webhook received', status: 'success', at: '2026-01-28T00:00:00.000Z', message: 'ok' }
        ],
        resolvedActions: [{ ruleId: 'rule-1', robotId: 'robot-1', source: 'stored_actions' }]
      },
      replays: [
        {
          id: 'd0',
          repoId: 'r1',
          provider: 'github',
          eventName: 'push',
          mappedEventType: 'commit',
          result: 'accepted',
          httpStatus: 200,
          matchedRuleIds: ['rule-1'],
          matchedRobotIds: ['robot-1'],
          taskIds: [],
          taskGroupIds: [],
          replayMode: 'stored_actions',
          createdAt: '2026-01-27T00:00:00.000Z'
        }
      ]
    })),
    replayWebhookEvent: vi.fn(async () => ({
      id: 'd2',
      repoId: 'r1',
      provider: 'github',
      eventName: 'push',
      mappedEventType: 'commit',
      result: 'accepted',
      httpStatus: 202,
      matchedRuleIds: ['rule-1'],
      matchedRobotIds: ['robot-1'],
      taskIds: ['t2'],
      taskGroupIds: ['g2'],
      replayOfEventId: 'd1',
      replayMode: 'stored_actions',
      createdAt: '2026-01-29T00:00:00.000Z',
      payload: { foo: 'bar' },
      response: { tasks: ['t2'] },
      debugTrace: { source: 'replay', provider: 'github', steps: [] }
    })),
    replayWebhookEventDryRun: vi.fn(async () => ({
      id: 'd3',
      repoId: 'r1',
      provider: 'github',
      eventName: 'push',
      mappedEventType: 'commit',
      result: 'accepted',
      httpStatus: 200,
      matchedRuleIds: ['rule-1'],
      matchedRobotIds: ['robot-1'],
      taskIds: [],
      taskGroupIds: [],
      replayOfEventId: 'd1',
      replayMode: 'stored_actions',
      createdAt: '2026-01-29T00:00:00.000Z',
      payload: { foo: 'bar' },
      response: { dryRun: true },
      dryRunResult: { mode: 'stored_actions', results: [] },
      debugTrace: { source: 'replay', provider: 'github', steps: [] }
    }))
  };
});

const renderPanel = (repoId: string, deliveries: any[] = [], options?: { canManage?: boolean; onRefresh?: () => void }) =>
  render(
    <AntdApp>
      {/* Supply delivery data via props to mirror shared dashboard data flow. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128 */}
      <RepoWebhookDeliveriesPanel
        repoId={repoId}
        deliveries={deliveries}
        loading={false}
        loadFailed={false}
        onRefresh={options?.onRefresh || (() => undefined)}
        canManage={options?.canManage}
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
        mappedEventType: 'commit',
        result: 'accepted',
        httpStatus: 200,
        code: 'ok',
        message: 'accepted',
        matchedRuleIds: ['rule-1'],
        matchedRobotIds: ['robot-1'],
        taskIds: ['t1'],
        taskGroupIds: ['g1'],
        createdAt: '2026-01-28T00:00:00.000Z'
      }
    ]);

    await ui.click(await screen.findByRole('button', { name: 'View' }));

    // Assert detail fetch is triggered from the view action now that deliveries are provided by parent. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    await waitFor(() => expect(api.fetchRepoWebhookDelivery).toHaveBeenCalledWith('r1', 'd1'));
    expect(await screen.findByText('Received payload')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('"bar"')).toBeInTheDocument();
    expect(screen.getByText('Debug timeline')).toBeInTheDocument();
    expect(screen.getByText(/Matched rules/)).toBeInTheDocument();
    expect(screen.getByText('Replay history')).toBeInTheDocument();
    expect(document.querySelectorAll('.hc-json-viewer').length).toBeGreaterThan(0);
  });

  test('replays a delivery as dry-run from the detail modal', async () => {
    const ui = userEvent.setup();
    const refresh = vi.fn();
    renderPanel(
      'r1',
      [
        {
          id: 'd1',
          repoId: 'r1',
          provider: 'github',
          eventName: 'push',
          mappedEventType: 'commit',
          result: 'accepted',
          httpStatus: 200,
          matchedRuleIds: ['rule-1'],
          matchedRobotIds: ['robot-1'],
          taskIds: ['t1'],
          taskGroupIds: ['g1'],
          createdAt: '2026-01-28T00:00:00.000Z'
        }
      ],
      { canManage: true, onRefresh: refresh }
    );

    await ui.click(await screen.findByRole('button', { name: 'View' }));
    await waitFor(() => expect(api.fetchRepoWebhookDelivery).toHaveBeenCalledWith('r1', 'd1'));

    await ui.click(await screen.findByRole('button', { name: 'Replay dry-run' }));

    await waitFor(() =>
      expect(api.replayWebhookEventDryRun).toHaveBeenCalledWith('d1', { mode: 'stored_actions' })
    );
    expect(refresh).toHaveBeenCalled();
  });
});
