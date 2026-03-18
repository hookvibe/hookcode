jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    policyRule: { findMany: jest.fn() },
    repoRobot: { findUnique: jest.fn() }
  }
}));

import { db } from '../../db';
import { PolicyEngineService } from '../../policyEngine/policyEngine.service';

describe('policyEngine.evaluateTask', () => {
  const service = new PolicyEngineService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires approval for workspace-write tasks by default', async () => {
    (db.repoRobot.findUnique as any).mockResolvedValue({
      modelProvider: 'claude_code',
      modelProviderConfig: {
        sandbox: 'workspace-write',
        sandbox_workspace_write: { network_access: false }
      }
    });
    (db.policyRule.findMany as any).mockResolvedValue([]);

    const evaluation = await service.evaluateTask({
      id: 'task-1',
      repoId: 'repo-1',
      robotId: 'robot-1',
      actorUserId: 'user-1',
      eventType: 'chat',
      payload: { __chat: { text: 'Update the README.' } },
      title: 'Chat task'
    });

    expect(evaluation.decision).toBe('require_approval');
    expect(evaluation.riskLevel).toBe('high');
    expect(evaluation.details.sandbox).toBe('workspace-write');
  });

  test('uses matching allow rules before builtin approval gates', async () => {
    const now = new Date('2026-03-13T00:00:00.000Z');
    (db.repoRobot.findUnique as any).mockResolvedValue({
      modelProvider: 'claude_code',
      modelProviderConfig: {
        sandbox: 'workspace-write',
        sandbox_workspace_write: { network_access: false }
      }
    });
    (db.policyRule.findMany as any).mockResolvedValue([
      {
        id: 'rule-1',
        repoId: null,
        robotId: null,
        name: 'Allow workspace write chats',
        enabled: true,
        priority: 999,
        action: 'allow',
        conditions: {
          taskSources: ['chat'],
          sandboxes: ['workspace-write']
        },
        createdAt: now,
        updatedAt: now
      }
    ]);

    const evaluation = await service.evaluateTask({
      id: 'task-2',
      repoId: 'repo-1',
      robotId: 'robot-1',
      actorUserId: 'user-1',
      eventType: 'chat',
      payload: { __chat: { text: 'Refactor the workspace task.' } },
      title: 'Chat task'
    });

    expect(evaluation.decision).toBe('allow');
    expect(evaluation.details.matchedRules[0]).toMatchObject({
      id: 'rule-1',
      name: 'Allow workspace write chats',
      source: 'policy_rule'
    });
  });

  test('matches repo provider and event type conditions when present', async () => {
    const now = new Date('2026-03-13T00:00:00.000Z');
    (db.repoRobot.findUnique as any).mockResolvedValue(null);
    (db.policyRule.findMany as any).mockResolvedValue([
      {
        id: 'rule-2',
        repoId: null,
        robotId: null,
        name: 'Allow gitlab push events',
        enabled: true,
        priority: 999,
        action: 'allow',
        conditions: {
          repoProviders: ['gitlab'],
          eventTypes: ['push']
        },
        createdAt: now,
        updatedAt: now
      }
    ]);

    const evaluation = await service.evaluateTask({
      id: 'task-3',
      repoId: 'repo-1',
      repoProvider: 'gitlab',
      actorUserId: 'user-1',
      eventType: 'push',
      payload: { after: 'abc123' },
      title: 'Push task'
    });

    expect(evaluation.decision).toBe('allow');
    expect(evaluation.details.matchedRules[0]).toMatchObject({
      id: 'rule-2',
      name: 'Allow gitlab push events',
      source: 'policy_rule'
    });
  });
});
