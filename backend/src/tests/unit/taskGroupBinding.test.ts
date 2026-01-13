jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    task: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn()
    },
    taskGroup: {
      upsert: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    repository: { findMany: jest.fn() },
    repoRobot: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn()
  }
}));

import { db } from '../../db';
import { TaskService } from '../../modules/tasks/task.service';

const taskService = new TaskService();

describe('task group binding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createTask: issue binds to a stable TaskGroup via bindingKey', async () => {
    const repoId = '11111111-1111-1111-1111-111111111111';
    const robotId = '22222222-2222-2222-2222-222222222222';
    const groupId = '33333333-3333-3333-3333-333333333333';
    const taskId = '44444444-4444-4444-4444-444444444444';
    const now = new Date('2026-01-09T00:00:00.000Z');

    (db.taskGroup.upsert as any).mockResolvedValue({ id: groupId });
    (db.task.create as any).mockResolvedValue({
      id: taskId,
      groupId,
      eventType: 'issue',
      status: 'queued',
      payload: { hello: 'world' },
      promptCustom: null,
      title: 'Issue #123',
      projectId: null,
      repoProvider: 'gitlab',
      repoId,
      robotId,
      ref: null,
      mrId: null,
      issueId: 123,
      retries: 0,
      result: null,
      createdAt: now,
      updatedAt: now
    });

    const task = await taskService.createTask('issue', { hello: 'world' }, { repoId, robotId, repoProvider: 'gitlab', issueId: 123, title: 'Issue #123' });

    expect(db.taskGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bindingKey: `${repoId}:${robotId}:issue:123` },
        create: expect.objectContaining({
          kind: 'issue',
          issueId: 123,
          mrId: null,
          commitSha: null,
          repoId,
          robotId,
          repoProvider: 'gitlab'
        })
      })
    );
    expect(db.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ groupId }) }));
    expect(task.groupId).toBe(groupId);
  });

  test('createTask: commit binds to a stable TaskGroup via commit sha', async () => {
    const repoId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const robotId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const groupId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const taskId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const now = new Date('2026-01-09T00:00:00.000Z');

    (db.taskGroup.upsert as any).mockResolvedValue({ id: groupId });
    (db.task.create as any).mockResolvedValue({
      id: taskId,
      groupId,
      eventType: 'commit',
      status: 'queued',
      payload: { after: 'ca6451cd902eb97139df4832a0e1cb401d522fd2' },
      promptCustom: null,
      title: 'Commit',
      projectId: null,
      repoProvider: 'gitlab',
      repoId,
      robotId,
      ref: null,
      mrId: null,
      issueId: null,
      retries: 0,
      result: null,
      createdAt: now,
      updatedAt: now
    });

    await taskService.createTask(
      'commit',
      { after: 'ca6451cd902eb97139df4832a0e1cb401d522fd2' },
      { repoId, robotId, repoProvider: 'gitlab', title: 'Commit' }
    );

    expect(db.taskGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bindingKey: `${repoId}:${robotId}:commit:ca6451cd902eb97139df4832a0e1cb401d522fd2` },
        create: expect.objectContaining({
          kind: 'commit',
          commitSha: 'ca6451cd902eb97139df4832a0e1cb401d522fd2'
        })
      })
    );
  });

  test('ensureTaskGroupId: backfills group_id for legacy tasks', async () => {
    const repoId = '11111111-1111-1111-1111-111111111111';
    const robotId = '22222222-2222-2222-2222-222222222222';
    const groupId = '33333333-3333-3333-3333-333333333333';
    const taskId = '44444444-4444-4444-4444-444444444444';

    (db.taskGroup.upsert as any).mockResolvedValue({ id: groupId });
    (db.task.update as any).mockResolvedValue({ id: taskId, groupId });

    const ensured = await taskService.ensureTaskGroupId({
      id: taskId,
      groupId: undefined,
      eventType: 'issue',
      status: 'queued',
      payload: {},
      title: 'Issue #5',
      projectId: 1,
      repoProvider: 'gitlab',
      repoId,
      robotId,
      issueId: 5,
      mrId: undefined,
      ref: undefined,
      retries: 0,
      result: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    expect(ensured).toBe(groupId);
    expect(db.task.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: taskId }, data: expect.objectContaining({ groupId }) }));
  });

  test('bindTaskGroupThreadId: sets thread_id only when empty', async () => {
    const groupId = '33333333-3333-3333-3333-333333333333';
    (db.taskGroup.updateMany as any).mockResolvedValue({ count: 1 });

    const updated = await taskService.bindTaskGroupThreadId(groupId, 't_123');
    expect(updated).toBe(true);
    expect(db.taskGroup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: groupId, threadId: null }),
        data: expect.objectContaining({ threadId: 't_123' })
      })
    );
  });

  test('createTaskInGroup: updates group.updatedAt and enqueues a task under the explicit group', async () => {
    const repoId = '11111111-1111-1111-1111-111111111111';
    const robotId = '22222222-2222-2222-2222-222222222222';
    const groupId = '33333333-3333-3333-3333-333333333333';
    const taskId = '44444444-4444-4444-4444-444444444444';
    const now = new Date('2026-01-09T00:00:00.000Z');

    (db.taskGroup.update as any).mockResolvedValue({ id: groupId });
    (db.task.create as any).mockResolvedValue({
      id: taskId,
      groupId,
      eventType: 'chat',
      status: 'queued',
      payload: { __chat: { text: 'hello' } },
      promptCustom: 'PROMPT',
      title: 'Chat',
      projectId: null,
      repoProvider: 'gitlab',
      repoId,
      robotId,
      ref: null,
      mrId: null,
      issueId: null,
      retries: 0,
      result: null,
      createdAt: now,
      updatedAt: now
    });

    const task = await taskService.createTaskInGroup(
      groupId,
      'chat',
      { __chat: { text: 'hello' } },
      { repoId, robotId, repoProvider: 'gitlab', title: 'Chat', promptCustom: 'PROMPT' },
      { updateGroupRobotId: true }
    );

    expect(db.taskGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: groupId },
        data: expect.objectContaining({ robotId })
      })
    );
    expect(db.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ groupId }) }));
    expect(task.groupId).toBe(groupId);
  });

  test('createManualTaskGroup: creates a new chat group with unique bindingKey', async () => {
    const now = new Date('2026-01-09T00:00:00.000Z');
    const groupId = '33333333-3333-3333-3333-333333333333';

    (db.taskGroup.create as any).mockResolvedValue({
      id: groupId,
      kind: 'chat',
      bindingKey: `chat:${groupId}`,
      threadId: null,
      title: 'Chat',
      repoProvider: 'gitlab',
      repoId: null,
      robotId: null,
      issueId: null,
      mrId: null,
      commitSha: null,
      createdAt: now,
      updatedAt: now
    });

    const created = await taskService.createManualTaskGroup({ kind: 'chat', title: 'Chat', repoProvider: 'gitlab' });
    expect(db.taskGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'chat',
          bindingKey: expect.stringMatching(/^chat:/)
        })
      })
    );
    expect(created.kind).toBe('chat');
  });
});
