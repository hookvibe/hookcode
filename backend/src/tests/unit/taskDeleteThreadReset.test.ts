jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    task: { findUnique: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
    taskGroup: { updateMany: jest.fn() }
  }
}));

import { db } from '../../db';
import { TaskService } from '../../modules/tasks/task.service';

const taskService = new TaskService();

// Cover task-group thread cleanup after task deletion. docs/en/developer/plans/taskgroup-resume-thread-20260203/task_plan.md taskgroup-resume-thread-20260203
describe('task delete thread cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deleteTask returns false for invalid id', async () => {
    const result = await taskService.deleteTask('not-a-uuid');

    expect(result).toBe(false);
    expect(db.task.findUnique).not.toHaveBeenCalled();
  });

  test('deleteTask clears threadId when last task is removed', async () => {
    const taskId = '11111111-1111-1111-1111-111111111111';
    const groupId = '22222222-2222-2222-2222-222222222222';

    (db.task.findUnique as jest.Mock).mockResolvedValue({ id: taskId, groupId });
    (db.task.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (db.task.count as jest.Mock).mockResolvedValue(0);
    (db.taskGroup.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await taskService.deleteTask(taskId);

    expect(result).toBe(true);
    expect(db.taskGroup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: groupId },
        data: expect.objectContaining({ threadId: null })
      })
    );
  });

  test('deleteTask keeps threadId when other tasks remain', async () => {
    const taskId = '33333333-3333-3333-3333-333333333333';
    const groupId = '44444444-4444-4444-4444-444444444444';

    (db.task.findUnique as jest.Mock).mockResolvedValue({ id: taskId, groupId });
    (db.task.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (db.task.count as jest.Mock).mockResolvedValue(2);

    const result = await taskService.deleteTask(taskId);

    expect(result).toBe(true);
    expect(db.taskGroup.updateMany).not.toHaveBeenCalled();
  });

  test('deleteTask returns false when task is missing', async () => {
    const taskId = '55555555-5555-5555-5555-555555555555';

    (db.task.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await taskService.deleteTask(taskId);

    expect(result).toBe(false);
    expect(db.task.deleteMany).not.toHaveBeenCalled();
  });
});
