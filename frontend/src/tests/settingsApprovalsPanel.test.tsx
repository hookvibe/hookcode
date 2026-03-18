import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import * as api from '../api';
import { setLocale } from '../i18n';
import { SettingsApprovalsPanel } from '../components/settings/SettingsApprovalsPanel';

vi.mock('../api', () => ({
  __esModule: true,
  fetchApprovals: vi.fn(),
  approveApprovalRequest: vi.fn(),
  approveApprovalAlways: vi.fn(),
  rejectApprovalRequest: vi.fn(),
  requestApprovalChanges: vi.fn(),
  getApprovalErrorMessage: vi.fn((error: any) => error?.message || '')
}));

describe('SettingsApprovalsPanel', () => {
  beforeEach(() => {
    setLocale('en-US');
    vi.resetAllMocks();
    vi.mocked(api.fetchApprovals).mockResolvedValue({
      approvals: [
        {
          id: 'approval_1',
          taskId: 'task_1',
          status: 'pending',
          decision: 'require_approval',
          riskLevel: 'high',
          summary: 'Approve dependency changes',
          details: {
            taskSource: 'chat',
            provider: 'codex',
            sandbox: 'workspace-write',
            networkAccess: false,
            reasons: ['workspace-write requested'],
            warnings: [],
            matchedRules: [{ id: 'rule_1', name: 'Workspace write gate', action: 'require_approval', source: 'policy_rule' }],
            commands: ['pnpm install'],
            targetFiles: ['package.json']
          },
          actions: [],
          createdAt: '2026-01-11T00:00:00.000Z',
          updatedAt: '2026-01-11T00:00:00.000Z'
        }
      ]
    } as any);
    vi.mocked(api.approveApprovalRequest).mockResolvedValue({
      id: 'approval_1',
      taskId: 'task_1',
      status: 'approved',
      decision: 'require_approval',
      riskLevel: 'high',
      summary: 'Approve dependency changes',
      details: {
        taskSource: 'chat',
        sandbox: 'workspace-write',
        networkAccess: false,
        reasons: ['workspace-write requested'],
        warnings: [],
        matchedRules: [],
        commands: ['pnpm install'],
        targetFiles: ['package.json']
      },
      actions: [],
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z'
    } as any);
    vi.mocked(api.rejectApprovalRequest).mockResolvedValue({} as any);
    vi.mocked(api.requestApprovalChanges).mockResolvedValue({} as any);
  });

  test('loads inbox entries and approves a request', async () => {
    const ui = userEvent.setup();
    render(
      <AntdApp>
        <SettingsApprovalsPanel />
      </AntdApp>
    );

    expect(await screen.findByText('Approve dependency changes')).toBeInTheDocument();
    expect(screen.getByText('Open task')).toBeInTheDocument();

    await ui.click(screen.getAllByRole('button', { name: /Approve/ })[0]);

    await waitFor(() =>
      expect(api.approveApprovalRequest).toHaveBeenCalledWith('approval_1', { note: '' })
    );
    await waitFor(() => expect(api.fetchApprovals).toHaveBeenCalledTimes(2));
  });
});
