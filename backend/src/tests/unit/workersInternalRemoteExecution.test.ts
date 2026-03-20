import { WorkersInternalController } from '../../modules/workers/workers-internal.controller';

describe('WorkersInternalController remote execution endpoints', () => {
  const headers = {
    'x-hookcode-worker-id': 'worker-remote',
    'x-hookcode-worker-token': 'secret'
  };

  const createController = () => {
    const worker = { id: 'worker-remote', kind: 'remote', systemManaged: false };
    const task = { id: 'task-1', workerId: 'worker-remote' };
    const workersService = {
      verifyWorkerToken: jest.fn().mockResolvedValue(worker)
    };
    const taskService = {
      getTask: jest.fn().mockResolvedValue(task)
    };
    const agentService = {
      buildRemoteExecutionBundle: jest.fn().mockResolvedValue({ taskId: 'task-1', taskGroupId: 'group-1' }),
      postRemoteExecutionResult: jest.fn().mockResolvedValue({ providerCommentUrl: 'https://example.com/comment/1' })
    };
    const controller = new WorkersInternalController(
      workersService as any,
      taskService as any,
      agentService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { controller, agentService, task };
  };

  test('returns the backend-built remote execution bundle for the assigned worker task', async () => {
    const { controller, agentService, task } = createController();

    await expect(controller.getExecutionBundle(headers, 'task-1')).resolves.toEqual({
      bundle: { taskId: 'task-1', taskGroupId: 'group-1' }
    });

    expect(agentService.buildRemoteExecutionBundle).toHaveBeenCalledWith(task);
  });

  test('posts remote provider results through agentService', async () => {
    const { controller, agentService, task } = createController();

    await expect(
      controller.postProviderResult(headers, 'task-1', {
        status: 'failed',
        outputText: 'ignored',
        message: ' provider error '
      })
    ).resolves.toEqual({ providerCommentUrl: 'https://example.com/comment/1' });

    expect(agentService.postRemoteExecutionResult).toHaveBeenCalledWith(task, {
      status: 'failed',
      outputText: 'ignored',
      message: 'provider error'
    });
  });
});
