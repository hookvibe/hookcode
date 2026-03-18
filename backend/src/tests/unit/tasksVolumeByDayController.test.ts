import { BadRequestException } from '@nestjs/common';
import { TasksController } from '../../modules/tasks/tasks.controller';
import { WorkersConnectionService } from '../../modules/workers/workers-connection.service';

// Unit tests for the tasks volume-by-day endpoint used by the repo dashboard chart. dashtrendline20260119m9v2

describe('TasksController.volumeByDay', () => {
  const repoId = '00000000-0000-0000-0000-000000000001';
  // Provide a request user for RBAC-protected endpoints in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const req = { user: { id: 'u1', username: 'u1', roles: [] } } as any;

  test('parses UTC day range and calls TaskService with an exclusive end boundary', async () => {
    const taskService: any = {
      getTaskVolumeByDay: jest.fn().mockResolvedValue([{ day: '2026-01-19', count: 1 }])
    };

    // Provide controller constructor stubs for DI coverage. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    const taskWorkspaceService = {} as any; // Keep volume-by-day controller tests aligned with the current workspace dependency list. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const repoAccessService = { requireRepoRead: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for volume-by-day tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    const workersConnections = {} as WorkersConnectionService; // Keep controller unit tests aligned with the new worker dispatch dependency. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const controller = new TasksController(
      taskService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      taskWorkspaceService,
      repoAccessService as any,
      {} as any,
      workersConnections as any
    );
    // Keep API parity with the new `archived` query param added to volumeByDay. qnp1mtxhzikhbi0xspbc
    const res = await controller.volumeByDay(req, repoId, '2026-01-01', '2026-01-02', undefined, undefined, undefined);

    expect(taskService.getTaskVolumeByDay).toHaveBeenCalledTimes(1);
    const args = (taskService.getTaskVolumeByDay as jest.Mock).mock.calls[0][0];
    expect(args.repoId).toBe(repoId);
    expect(args.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(args.endExclusive.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(res).toEqual({ points: [{ day: '2026-01-19', count: 1 }] });
  });

  test('rejects invalid date inputs', async () => {
    const taskService: any = { getTaskVolumeByDay: jest.fn() };
    // Provide controller constructor stubs for DI coverage. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    const taskWorkspaceService = {} as any; // Keep volume-by-day controller tests aligned with the current workspace dependency list. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const repoAccessService = { requireRepoRead: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for volume-by-day tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    const workersConnections = {} as WorkersConnectionService; // Keep controller unit tests aligned with the new worker dispatch dependency. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const controller = new TasksController(
      taskService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      taskWorkspaceService,
      repoAccessService as any,
      {} as any,
      workersConnections as any
    );

    await expect(
      controller.volumeByDay(req, repoId, '2026-99-01', '2026-01-02', undefined, undefined, undefined)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.volumeByDay(req, repoId, '2026-01-01', 'bad', undefined, undefined, undefined)
    ).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
