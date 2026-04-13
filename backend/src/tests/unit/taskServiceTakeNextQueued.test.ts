jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    $queryRaw: jest.fn()
  }
}));

import { db } from '../../db';
import { TaskService } from '../../modules/tasks/task.service';

// Validate task-group processing exclusivity when claiming queued tasks. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
describe('taskService.takeNextQueued', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('publishes a task-group refresh when a queued task is claimed as processing', async () => {
    // Push the queued->processing transition so freshly-created task-group pages do not wait for a manual refresh. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const now = new Date('2026-03-06T00:00:00.000Z');
    const queuedRow = {
      id: 't1',
      group_id: 'g1',
      event_type: 'chat',
      status: 'queued',
      archived_at: null,
      payload_json: {},
      prompt_custom: null,
      title: null,
      project_id: null,
      repo_provider: null,
      repo_id: 'r1',
      robot_id: null,
      actor_user_id: 'u1',
      ref: null,
      mr_id: null,
      issue_id: null,
      retries: 0,
      result_json: null,
      dependency_result: null,
      created_at: now,
      updated_at: now
    };
    const processingRow = { ...queuedRow, status: 'processing' };

    (db.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([queuedRow])
      .mockResolvedValueOnce([processingRow]);

    const eventStream = { publish: jest.fn() };
    const logWriter = { logSystem: jest.fn().mockResolvedValue(undefined) };
    const notificationRecipients = {
      resolveRecipientsForTask: jest.fn().mockResolvedValue(['u1'])
    };

    const taskService = new TaskService(eventStream as any, logWriter as any, undefined, notificationRecipients as any);
    const claimed = await taskService.takeNextQueued();
    await new Promise((resolve) => setImmediate(resolve));

    expect(claimed?.status).toBe('processing');
    expect(eventStream.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'task-group:g1',
        event: 'task-group.refresh',
        data: expect.objectContaining({ taskId: 't1', status: 'processing', reason: 'status' })
      })
    );
  });

  test('skips candidates that conflict with active task-group processing and claims the next available task', async () => {
    const now = new Date('2026-02-27T00:00:00.000Z');
    const task1 = {
      id: 't1',
      group_id: 'g1',
      event_type: 'issue',
      status: 'queued',
      archived_at: null,
      payload_json: null,
      prompt_custom: null,
      title: null,
      project_id: null,
      repo_provider: null,
      repo_id: null,
      robot_id: null,
      ref: null,
      mr_id: null,
      issue_id: null,
      retries: 0,
      result_json: null,
      dependency_result: null,
      created_at: now,
      updated_at: now
    };
    const task2 = {
      ...task1,
      id: 't2',
      group_id: 'g2'
    };

    const conflictError = {
      code: 'P2010',
      meta: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "tasks_group_processing_unique_idx"'
      }
    };

    (db.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([task1, task2])
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce([task2]);

    const taskService = new TaskService();
    const claimed = await taskService.takeNextQueued();

    expect(claimed?.id).toBe('t2');

    const updateCall = (db.$queryRaw as jest.Mock).mock.calls[1]?.[0];
    const sql = Array.isArray(updateCall) ? updateCall.join('') : String(updateCall ?? '');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain("active.status = 'processing'");
  });
});
