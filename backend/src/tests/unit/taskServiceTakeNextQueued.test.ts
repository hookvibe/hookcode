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
