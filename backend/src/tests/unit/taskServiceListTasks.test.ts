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
    const robotCatalogService = {
      buildTaskRobotSummaryMap: jest.fn().mockResolvedValue(
        new Map([
          [
            'rb1',
            { id: 'rb1', scope: 'repo', repoId: 'r1', name: 'hookcode-review', permission: 'read', enabled: true }
          ]
        ])
      )
    };

    const tasks = await new TaskService(undefined, undefined, robotCatalogService as any).listTasks({ status: 'success', includeMeta: true });

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

  // Validate queued task diagnosis attachment and reason code selection. f3a9c2d8e1b7f4a0c6d1
  test('includeMeta=true 时 queued 任务会附带 queue diagnosis（reasonCode + ahead/processing 等）', async () => {
    const prevInlineWorkerEnabled = process.env.INLINE_WORKER_ENABLED;
    delete process.env.INLINE_WORKER_ENABLED;

    (db.$queryRaw as any)
      // listTasks raw SQL query result
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000001',
          event_type: 'issue',
          status: 'queued',
          title: 'tq1',
          project_id: null,
          repo_provider: null,
          repo_id: null,
          robot_id: null,
          ref: null,
          mr_id: null,
          issue_id: null,
          retries: 0,
          result_json: null,
          created_at: new Date('2026-01-19T00:00:00.000Z'),
          updated_at: new Date('2026-01-19T00:00:00.000Z')
        }
      ])
      // attachQueueDiagnosis: queue position query
      .mockResolvedValueOnce([{ id: '00000000-0000-0000-0000-000000000001', ahead: 2, total: 5 }])
      // attachQueueDiagnosis: processing counts query
      .mockResolvedValueOnce([{ processing: 0, stale_processing: 0 }]);

    (db.repository.findMany as any).mockResolvedValue([]);
    (db.repoRobot.findMany as any).mockResolvedValue([]);

    const tasks = await taskService.listTasks({ status: 'queued', includeMeta: true, limit: 10 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].queue).toEqual(
      expect.objectContaining({
        reasonCode: 'no_active_worker',
        ahead: 2,
        queuedTotal: 5,
        processing: 0,
        staleProcessing: 0,
        inlineWorkerEnabled: true
      })
    );

    if (prevInlineWorkerEnabled === undefined) delete process.env.INLINE_WORKER_ENABLED;
    else process.env.INLINE_WORKER_ENABLED = prevInlineWorkerEnabled;
  });

  test('includeQueue=false 时不执行额外的 queue diagnosis 查询', async () => {
    // Skip queue diagnosis when dashboards request lightweight task summaries. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    (db.$queryRaw as any).mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000010',
        event_type: 'issue',
        status: 'queued',
        title: 'tq-lite',
        project_id: null,
        repo_provider: null,
        repo_id: null,
        robot_id: null,
        ref: null,
        mr_id: null,
        issue_id: null,
        retries: 0,
        result_json: null,
        created_at: new Date('2026-01-19T00:00:00.000Z'),
        updated_at: new Date('2026-01-19T00:00:00.000Z')
      }
    ]);
    (db.repository.findMany as any).mockResolvedValue([]);
    (db.repoRobot.findMany as any).mockResolvedValue([]);

    const tasks = await taskService.listTasks({ status: 'queued', includeMeta: true, includeQueue: false, limit: 10 });

    expect(tasks).toHaveLength(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test('processing=0 still reports no_active_worker after inline-worker removal', async () => {
    // Keep queue diagnostics aligned with the external worker model after removing inline-worker-specific reason codes. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const prevInlineWorkerEnabled = process.env.INLINE_WORKER_ENABLED;
    process.env.INLINE_WORKER_ENABLED = 'false';

    (db.$queryRaw as any)
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000002',
          event_type: 'issue',
          status: 'queued',
          title: 'tq2',
          project_id: null,
          repo_provider: null,
          repo_id: null,
          robot_id: null,
          ref: null,
          mr_id: null,
          issue_id: null,
          retries: 0,
          result_json: null,
          created_at: new Date('2026-01-19T00:00:00.000Z'),
          updated_at: new Date('2026-01-19T00:00:00.000Z')
        }
      ])
      .mockResolvedValueOnce([{ id: '00000000-0000-0000-0000-000000000002', ahead: 0, total: 1 }])
      .mockResolvedValueOnce([{ processing: 0, stale_processing: 0 }]);

    (db.repository.findMany as any).mockResolvedValue([]);
    (db.repoRobot.findMany as any).mockResolvedValue([]);

    const tasks = await taskService.listTasks({ status: 'queued', includeMeta: true, limit: 10 });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].queue?.reasonCode).toBe('no_active_worker');

    if (prevInlineWorkerEnabled === undefined) delete process.env.INLINE_WORKER_ENABLED;
    else process.env.INLINE_WORKER_ENABLED = prevInlineWorkerEnabled;
  });

  test('getTaskStats 会聚合状态计数，并将 succeeded+commented 归为 success', async () => {
    (db.task.groupBy as any).mockResolvedValue([
      { status: 'queued', _count: { _all: 2 } },
      { status: 'processing', _count: { _all: 3 } },
      // Keep unknown historical statuses in aggregation input to verify the stop-only stats shape ignores them. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
      { status: 'paused', _count: { _all: 4 } },
      { status: 'succeeded', _count: { _all: 10 } },
      { status: 'commented', _count: { _all: 5 } },
      { status: 'failed', _count: { _all: 1 } }
    ]);

    const stats = await taskService.getTaskStats();

    expect(db.task.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        // Default stats exclude archived tasks via `archivedAt = null`. qnp1mtxhzikhbi0xspbc
        where: { archivedAt: null }
      })
    );
    // Validate task stats only expose the active stop-only lifecycle fields on the dashboard. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    expect(stats).toEqual({
      total: 25,
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
          repoId: { in: ['r1'] },
          archivedAt: null
        })
      })
    );
  });
});
