jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    repoRobot: {
      findUnique: jest.fn()
    }
  }
}));

import { db } from '../../db';
import { QuotaEnforcerService } from '../../costGovernance/quotaEnforcer.service';

describe('QuotaEnforcerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns degrade override when repo policy exceeds cost budget', async () => {
    (db.repoRobot.findUnique as jest.Mock).mockResolvedValue({
      modelProvider: 'codex',
      modelProviderConfig: { model: 'gpt-5.1-codex-max', sandbox: 'workspace-write' }
    });

    const budgetService = {
      listApplicablePolicies: jest.fn().mockResolvedValue([
        {
          id: 'policy-1',
          scopeType: 'repo',
          scopeId: 'repo-1',
          name: 'Repo monthly cap',
          enabled: true,
          overageAction: 'degrade',
          monthlyEstimatedCostUsdLimit: 5,
          forceReadOnlyOnOverage: true,
          createdAt: '2026-03-13T00:00:00.000Z',
          updatedAt: '2026-03-13T00:00:00.000Z'
        }
      ])
    };
    const usageAggregationService = {
      getScopeUsageSnapshot: jest
        .fn()
        .mockResolvedValue({ taskCount: 3, inputTokens: 50_000, outputTokens: 25_000, totalTokens: 75_000, estimatedCostMicroUsd: 6_000_000n })
    };

    const service = new QuotaEnforcerService(budgetService as any, usageAggregationService as any);
    const result = await service.evaluateTask({
      id: 'task-1',
      groupId: 'group-1',
      eventType: 'chat',
      status: 'queued',
      payload: {},
      title: 'Chat task',
      repoId: 'repo-1',
      robotId: 'robot-1',
      retries: 0,
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z'
    });

    expect(result?.decision).toBe('degrade');
    expect(result?.matchedScopeType).toBe('repo');
    expect(result?.executionOverride?.provider).toBe('gemini_cli');
    expect(result?.executionOverride?.forceReadOnly).toBe(true);
    expect(result?.summary).toContain('execution degraded');
  });

  test('returns allow with runtime override when only max runtime is configured', async () => {
    (db.repoRobot.findUnique as jest.Mock).mockResolvedValue({
      modelProvider: 'gemini_cli',
      modelProviderConfig: { model: 'gemini-2.5-pro', sandbox: 'read-only', sandbox_workspace_write: { network_access: false } }
    });

    const budgetService = {
      listApplicablePolicies: jest.fn().mockResolvedValue([
        {
          id: 'policy-2',
          scopeType: 'user',
          scopeId: 'user-1',
          enabled: true,
          overageAction: 'soft_limit',
          maxRuntimeSeconds: 120,
          forceReadOnlyOnOverage: false,
          createdAt: '2026-03-13T00:00:00.000Z',
          updatedAt: '2026-03-13T00:00:00.000Z'
        }
      ])
    };
    const usageAggregationService = {
      getScopeUsageSnapshot: jest.fn()
    };

    const service = new QuotaEnforcerService(budgetService as any, usageAggregationService as any);
    const result = await service.evaluateTask({
      id: 'task-2',
      groupId: 'group-1',
      eventType: 'chat',
      status: 'queued',
      payload: {},
      title: 'Chat task',
      actorUserId: 'user-1',
      repoId: 'repo-1',
      robotId: 'robot-1',
      retries: 0,
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z'
    });

    expect(result?.decision).toBe('allow');
    expect(result?.executionOverride?.maxRuntimeSeconds).toBe(120);
    expect(usageAggregationService.getScopeUsageSnapshot).not.toHaveBeenCalled();
  });
});
