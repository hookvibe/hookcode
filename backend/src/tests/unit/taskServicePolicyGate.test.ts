jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    task: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    taskGroup: {
      upsert: jest.fn()
    }
  }
}));

import { db } from '../../db';
import { TaskService } from '../../modules/tasks/task.service';

const makePolicyEvaluation = () => ({
  decision: 'require_approval' as const,
  riskLevel: 'high' as const,
  summary: 'Approval required: Workspace-write can modify repository files.',
  details: {
    taskSource: 'chat',
    provider: 'claude_code',
    sandbox: 'workspace-write',
    networkAccess: false,
    targetFiles: [],
    commands: [],
    reasons: ['Workspace-write can modify repository files.'],
    warnings: [],
    matchedRules: []
  }
});

describe('taskService policy gate integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.task.aggregate as any).mockResolvedValue({ _max: { groupOrder: null } });
  });

  test('createTask enqueues approvals when the policy engine blocks execution', async () => {
    const groupId = '33333333-3333-3333-3333-333333333333';
    const taskId = '44444444-4444-4444-4444-444444444444';
    const now = new Date('2026-03-13T00:00:00.000Z');
    const policyEngine = { evaluateTask: jest.fn().mockResolvedValue(makePolicyEvaluation()) };
    const approvalQueue = { enqueueApproval: jest.fn().mockResolvedValue(undefined) };
    const workersService = {
      findEffectiveWorkerId: jest.fn().mockResolvedValue('worker-1'),
      requireWorkerReadyForNewTask: jest.fn().mockResolvedValue({ ok: true })
    };

    (db.taskGroup.upsert as any).mockResolvedValue({ id: groupId });
    (db.task.create as any).mockResolvedValue({
      id: taskId,
      groupId,
      groupOrder: 1,
      eventType: 'chat',
      status: 'queued',
      payload: { __chat: { text: 'Ship code changes.' } },
      promptCustom: null,
      title: 'Chat task',
      projectId: null,
      repoProvider: 'gitlab',
      repoId: 'repo-1',
      robotId: 'robot-1',
      workerId: null,
      actorUserId: 'user-1',
      ref: null,
      mrId: null,
      issueId: null,
      retries: 0,
      result: null,
      createdAt: now,
      updatedAt: now
    });

    const service = new TaskService(undefined, undefined, undefined, undefined, workersService as any, policyEngine as any, approvalQueue as any);
    jest.spyOn(service as any, 'getTask').mockResolvedValue({
      id: taskId,
      groupId,
      eventType: 'chat',
      status: 'waiting_approval',
      payload: { __chat: { text: 'Ship code changes.' } },
      title: 'Chat task',
      repoProvider: 'gitlab',
      repoId: 'repo-1',
      robotId: 'robot-1',
      actorUserId: 'user-1',
      retries: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      result: { message: 'Approval required: Workspace-write can modify repository files.' }
    });

    const task = await service.createTask('chat', { __chat: { text: 'Ship code changes.' } }, {
      repoId: 'repo-1',
      robotId: 'robot-1',
      repoProvider: 'gitlab',
      actorUserId: 'user-1',
      title: 'Chat task'
    });

    expect(policyEngine.evaluateTask).toHaveBeenCalled();
    expect(approvalQueue.enqueueApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        repoId: 'repo-1',
        robotId: 'robot-1',
        actorUserId: 'user-1'
      })
    );
    expect(task.status).toBe('waiting_approval');
  });

  test('updateQueuedTaskText re-runs the policy gate after edits', async () => {
    const taskId = '44444444-4444-4444-4444-444444444444';
    const now = new Date('2026-03-13T00:00:00.000Z');
    const policyEngine = { evaluateTask: jest.fn().mockResolvedValue(makePolicyEvaluation()) };
    const approvalQueue = { enqueueApproval: jest.fn().mockResolvedValue(undefined) };
    const workersService = {
      findEffectiveWorkerId: jest.fn().mockResolvedValue('worker-1'),
      requireWorkerReadyForNewTask: jest.fn().mockResolvedValue({ ok: true })
    };

    (db.task.findUnique as any).mockResolvedValue({
      id: taskId,
      groupId: '33333333-3333-3333-3333-333333333333',
      eventType: 'chat',
      status: 'queued',
      payload: { __chat: { text: 'old text' } },
      promptCustom: null,
      title: 'Chat task',
      projectId: null,
      repoProvider: 'gitlab',
      repoId: 'repo-1',
      robotId: 'robot-1',
      workerId: null,
      actorUserId: 'user-1',
      ref: null,
      mrId: null,
      issueId: null,
      retries: 0,
      result: null,
      createdAt: now,
      updatedAt: now
    });
    (db.task.update as any).mockResolvedValue({
      id: taskId,
      groupId: '33333333-3333-3333-3333-333333333333',
      eventType: 'chat',
      status: 'queued',
      payload: { __chat: { text: 'Edit infra/main.tf' } },
      promptCustom: null,
      title: 'Chat · Edit infra/main.tf',
      projectId: null,
      repoProvider: 'gitlab',
      repoId: 'repo-1',
      robotId: 'robot-1',
      workerId: null,
      actorUserId: 'user-1',
      ref: null,
      mrId: null,
      issueId: null,
      retries: 0,
      result: null,
      createdAt: now,
      updatedAt: now
    });

    const service = new TaskService(undefined, undefined, undefined, undefined, workersService as any, policyEngine as any, approvalQueue as any);
    jest.spyOn(service as any, 'getTask').mockResolvedValue({
      id: taskId,
      groupId: '33333333-3333-3333-3333-333333333333',
      eventType: 'chat',
      status: 'waiting_approval',
      payload: { __chat: { text: 'Edit infra/main.tf' } },
      title: 'Chat · Edit infra/main.tf',
      repoProvider: 'gitlab',
      repoId: 'repo-1',
      robotId: 'robot-1',
      actorUserId: 'user-1',
      retries: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      result: { message: 'Approval required: Workspace-write can modify repository files.' }
    });

    const task = await service.updateQueuedTaskText(taskId, 'Edit infra/main.tf');

    expect(policyEngine.evaluateTask).toHaveBeenCalled();
    expect(approvalQueue.enqueueApproval).toHaveBeenCalledWith(expect.objectContaining({ taskId }));
    expect(task?.status).toBe('waiting_approval');
  });
});
