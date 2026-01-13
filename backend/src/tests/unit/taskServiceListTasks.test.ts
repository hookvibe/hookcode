jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    task: { findMany: jest.fn(), groupBy: jest.fn() },
    $queryRaw: jest.fn(),
    repository: { findMany: jest.fn() },
    repoRobot: { findMany: jest.fn() }
  }
}));

import { db } from '../../db';
import { TaskService } from '../../modules/tasks/task.service';

const taskService = new TaskService();

describe('taskService.listTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('status=success 会映射为 succeeded+commented，并返回 repo/robot meta', async () => {
    (db.$queryRaw as any).mockResolvedValue([
      {
        id: 't1',
        event_type: 'issue',
        status: 'succeeded',
        title: 't1',
        project_id: null,
        repo_provider: 'gitlab',
        repo_id: 'r1',
        robot_id: 'rb1',
        ref: null,
        mr_id: null,
        issue_id: 1,
        retries: 0,
        result_json: { tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, outputText: 'L1\nL2' },
        created_at: new Date('2025-12-26T00:00:00.000Z'),
        updated_at: new Date('2025-12-26T00:00:01.000Z')
      }
    ]);
    (db.repository.findMany as any).mockResolvedValue([
      { id: 'r1', provider: 'gitlab', name: 'group/project', enabled: true }
    ]);
    (db.repoRobot.findMany as any).mockResolvedValue([
      { id: 'rb1', repoId: 'r1', name: 'hookcode-review', permission: 'read', enabled: true }
    ]);

    const tasks = await taskService.listTasks({ status: 'success', includeMeta: true });

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].repo?.id).toBe('r1');
    expect(tasks[0].robot?.id).toBe('rb1');
  });

  test('allowedRepoIds 为空时会直接返回空列表', async () => {
    const tasks = await taskService.listTasks({ allowedRepoIds: [], includeMeta: false });

    expect(tasks).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  test('orders listTasks results by updated_at desc for better "recent updates first" UX', async () => {
    (db.$queryRaw as any).mockResolvedValue([]);

    await taskService.listTasks({ status: 'queued', includeMeta: false, limit: 10 });

    const [sqlParts] = (db.$queryRaw as any).mock.calls?.[0] ?? [];
    const sql = Array.isArray(sqlParts) ? sqlParts.join('') : String(sqlParts ?? '');

    expect(sql).toContain('ORDER BY updated_at DESC');
    expect(sql).not.toContain('ORDER BY created_at DESC');
  });

  test('getTaskStats 会聚合状态计数，并将 succeeded+commented 归为 success', async () => {
    (db.task.groupBy as any).mockResolvedValue([
      { status: 'queued', _count: { _all: 2 } },
      { status: 'processing', _count: { _all: 3 } },
      { status: 'succeeded', _count: { _all: 10 } },
      { status: 'commented', _count: { _all: 5 } },
      { status: 'failed', _count: { _all: 1 } }
    ]);

    const stats = await taskService.getTaskStats();

    expect(db.task.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: {}
      })
    );
    expect(stats).toEqual({
      total: 21,
      queued: 2,
      processing: 3,
      success: 15,
      failed: 1
    });
  });

  test('getTaskStats 的 allowedRepoIds 会限制查询范围', async () => {
    (db.task.groupBy as any).mockResolvedValue([]);

    await taskService.getTaskStats({ allowedRepoIds: ['r1'] });

    expect(db.task.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          repoId: { in: ['r1'] }
        })
      })
    );
  });
});
