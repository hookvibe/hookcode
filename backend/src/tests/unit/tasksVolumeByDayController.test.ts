import { BadRequestException } from '@nestjs/common';
import { TasksController } from '../../modules/tasks/tasks.controller';

// Unit tests for the tasks volume-by-day endpoint used by the repo dashboard chart. dashtrendline20260119m9v2

describe('TasksController.volumeByDay', () => {
  const repoId = '00000000-0000-0000-0000-000000000001';

  test('parses UTC day range and calls TaskService with an exclusive end boundary', async () => {
    const taskService: any = {
      getTaskVolumeByDay: jest.fn().mockResolvedValue([{ day: '2026-01-19', count: 1 }])
    };

    // Provide a TaskGitPushService stub to satisfy the controller constructor. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
    const controller = new TasksController(taskService, {} as any, {} as any, {} as any);
    // Keep API parity with the new `archived` query param added to volumeByDay. qnp1mtxhzikhbi0xspbc
    const res = await controller.volumeByDay(repoId, '2026-01-01', '2026-01-02', undefined, undefined, undefined);

    expect(taskService.getTaskVolumeByDay).toHaveBeenCalledTimes(1);
    const args = (taskService.getTaskVolumeByDay as jest.Mock).mock.calls[0][0];
    expect(args.repoId).toBe(repoId);
    expect(args.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(args.endExclusive.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(res).toEqual({ points: [{ day: '2026-01-19', count: 1 }] });
  });

  test('rejects invalid date inputs', async () => {
    const taskService: any = { getTaskVolumeByDay: jest.fn() };
    // Provide a TaskGitPushService stub to satisfy the controller constructor. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
    const controller = new TasksController(taskService, {} as any, {} as any, {} as any);

    await expect(
      controller.volumeByDay(repoId, '2026-99-01', '2026-01-02', undefined, undefined, undefined)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.volumeByDay(repoId, '2026-01-01', 'bad', undefined, undefined, undefined)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
