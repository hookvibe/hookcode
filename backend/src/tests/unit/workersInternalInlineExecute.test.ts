// Verify inline execution stays limited to local workers after simplifying worker metadata and Docker defaults. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
import { ForbiddenException } from '@nestjs/common';
import { WorkersInternalController } from '../../modules/workers/workers-internal.controller';

describe('WorkersInternalController.executeInlineTask', () => {
  const createController = (worker: { id: string; kind: 'local' | 'remote' }) => {
    const workersService = {
      verifyWorkerToken: jest.fn().mockResolvedValue(worker)
    };
    const task = { id: 'task-1', workerId: worker.id };
    const taskService = {
      getTask: jest.fn().mockResolvedValue(task)
    };
    const taskRunner = {
      executeAssignedTaskInline: jest.fn().mockResolvedValue(undefined)
    };
    const controller = new WorkersInternalController(
      workersService as any,
      taskService as any,
      taskRunner as any,
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

  test('allows a local worker to delegate inline execution', async () => {
    const { controller, taskRunner, task } = createController({ id: 'worker-local', kind: 'local' });

    await expect(
      controller.executeInlineTask(
        {
          'x-hookcode-worker-id': 'worker-local',
          'x-hookcode-worker-token': 'secret'
        },
        'task-1'
      )
    ).resolves.toEqual({ success: true });

    expect(taskRunner.executeAssignedTaskInline).toHaveBeenCalledWith(task);
  });

  test('rejects remote workers from using backend inline execution', async () => {
    const { controller, taskRunner } = createController({ id: 'worker-remote', kind: 'remote' });

    await expect(
      controller.executeInlineTask(
        {
          'x-hookcode-worker-id': 'worker-remote',
          'x-hookcode-worker-token': 'secret'
        },
        'task-1'
      )
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(taskRunner.executeAssignedTaskInline).not.toHaveBeenCalled();
  });
});
