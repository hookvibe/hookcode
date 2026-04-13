// Verify inline fallback delegates commandless assigned tasks while still rejecting command-capable remote tunneling. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
import { ForbiddenException } from '@nestjs/common';
import { WorkersInternalController } from '../../modules/workers/workers-internal.controller';

describe('WorkersInternalController.executeInlineTask', () => {
  const createController = (
    worker: { id: string; kind: 'local' | 'remote'; systemManaged: boolean },
    task: { id: string; workerId: string; payload?: unknown; executionCommand?: string } = { id: 'task-1', workerId: worker.id }
  ) => {
    const workersService = {
      verifyWorkerToken: jest.fn().mockResolvedValue(worker)
    };
    const taskService = {
      getTask: jest.fn().mockResolvedValue(task)
    };
    const taskRunner = {
      executeAssignedTaskInline: jest.fn().mockResolvedValue(undefined)
    };
    const agentService = {};
    const controller = new WorkersInternalController(
      workersService as any,
      taskService as any,
      agentService as any,
      taskRunner as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { controller, workersService, taskService, taskRunner, task };
  };

  test('allows the local system-managed worker to delegate inline execution', async () => {
    const { controller, taskRunner, task } = createController({ id: 'worker-local', kind: 'local', systemManaged: true });

    await expect(
      controller.executeInlineTask(
        {
          'x-hookcode-worker-id': 'worker-local',
          'x-hookcode-worker-token': 'secret'
        },
        'task-1',
        {}
      )
    ).resolves.toEqual({ success: true });

    expect(taskRunner.executeAssignedTaskInline).toHaveBeenCalledWith(task);
  });

  test('allows remote workers to delegate commandless tasks inline', async () => {
    const { controller, taskRunner, task } = createController({ id: 'worker-remote', kind: 'remote', systemManaged: false });

    await expect(
      controller.executeInlineTask(
        {
          'x-hookcode-worker-id': 'worker-remote',
          'x-hookcode-worker-token': 'secret'
        },
        'task-1',
        { reason: 'missing_command' }
      )
    ).resolves.toEqual({ success: true });

    expect(taskRunner.executeAssignedTaskInline).toHaveBeenCalledWith(task);
  });

  test('rejects remote workers from tunneling command-capable tasks inline', async () => {
    const { controller, taskRunner } = createController(
      { id: 'worker-remote', kind: 'remote', systemManaged: false },
      { id: 'task-1', workerId: 'worker-remote', payload: { executor: { command: 'pnpm test' } } }
    );

    await expect(
      controller.executeInlineTask(
        {
          'x-hookcode-worker-id': 'worker-remote',
          'x-hookcode-worker-token': 'secret'
        },
        'task-1',
        { reason: 'missing_command' }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(taskRunner.executeAssignedTaskInline).not.toHaveBeenCalled();
  });
});
