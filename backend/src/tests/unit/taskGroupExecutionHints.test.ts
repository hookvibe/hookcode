jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    task: { findFirst: jest.fn() },
    $queryRaw: jest.fn()
  }
}));

import { db } from '../../db';
import { TaskService } from '../../modules/tasks/task.service';

const taskService = new TaskService();

// Cover task-group history and log checks used to drive workspace reuse warnings. docs/en/developer/plans/taskgroup-worker-env-20260203/task_plan.md taskgroup-worker-env-20260203
describe('TaskService task-group execution hints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('hasPriorTaskGroupTask returns false for invalid ids', async () => {
    const result = await taskService.hasPriorTaskGroupTask('not-a-uuid', 'also-not-a-uuid');

    expect(result).toBe(false);
    expect(db.task.findFirst).not.toHaveBeenCalled();
  });

  test('hasPriorTaskGroupTask returns true when another task exists', async () => {
    (db.task.findFirst as jest.Mock).mockResolvedValue({ id: 'aaaa' });

    const result = await taskService.hasPriorTaskGroupTask(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222'
    );

    expect(result).toBe(true);
    expect(db.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        // Exclude archived tasks so resumeThread/workspace reuse only uses active history. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
        where: {
          groupId: '11111111-1111-1111-1111-111111111111',
          NOT: { id: '22222222-2222-2222-2222-222222222222' },
          archivedAt: null
        },
        select: { id: true }
      })
    );
  });

  test('hasPriorTaskGroupTask returns false when no other task exists', async () => {
    (db.task.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await taskService.hasPriorTaskGroupTask(
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444'
    );

    expect(result).toBe(false);
  });

  test('hasTaskGroupLogs returns true when log query finds a row', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'log-task' }]);

    const result = await taskService.hasTaskGroupLogs('55555555-5555-5555-5555-555555555555');

    expect(result).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  test('hasTaskGroupLogs returns false when no logs are found', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue([]);

    const result = await taskService.hasTaskGroupLogs('66666666-6666-6666-6666-666666666666');

    expect(result).toBe(false);
  });
});
