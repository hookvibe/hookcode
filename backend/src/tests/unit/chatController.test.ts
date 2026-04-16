import { ChatController } from '../../modules/tasks/chat.controller';
import { TaskCreationGuardError } from '../../modules/tasks/task-creation-guard-error';

describe('ChatController.execute', () => {
  beforeEach(() => {
    process.env.INLINE_WORKER_ENABLED = 'false';
  });

  test('creates a new chat task group when taskGroupId is not provided', async () => {
    const taskService: any = {
      createManualTaskGroup: jest.fn().mockResolvedValue({ id: 'g1', kind: 'chat', repoId: 'r1' }),
      createTaskInGroup: jest.fn().mockResolvedValue({ id: 't1' }),
      getTask: jest.fn().mockResolvedValue({ id: 't1' }),
      getTaskGroup: jest.fn().mockResolvedValue({ id: 'g1', kind: 'chat', repoId: 'r1' })
    };
    const repositoryService: any = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        provider: 'gitlab',
        name: 'group/project',
        apiBaseUrl: 'https://gitlab.example.com',
        externalId: '123',
        branches: [],
        enabled: true
      })
    };
    const repoRobotService: any = {
      getById: jest.fn().mockResolvedValue({ id: 'rb1', repoId: 'r1', name: 'robot', enabled: true, promptDefault: 'PROMPT' })
    };
    const taskRunner: any = {
      // Return a promise because ChatController now fire-and-forgets the dispatcher with `.catch(...)`. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      trigger: jest.fn().mockResolvedValue(undefined)
    };

    const controller = new ChatController(taskService, repositoryService, repoRobotService, taskRunner);

    const req = { user: { id: 'u1' } } as any; // Provide request user for actor attribution. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    const res = await controller.execute(req, { repoId: 'r1', robotId: 'rb1', text: 'hello', workerId: 'w-local' } as any);
    expect(taskService.createManualTaskGroup).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'chat', repoId: 'r1', robotId: 'rb1', workerId: 'w-local' })
    );
    expect(taskService.createTaskInGroup).toHaveBeenCalledWith(
      'g1',
      'chat',
      expect.any(Object),
      // Assert chat worker overrides propagate into the created task options for the external worker dispatcher. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      expect.objectContaining({ repoId: 'r1', robotId: 'rb1', workerId: 'w-local', title: expect.stringContaining('Chat'), actorUserId: 'u1' }),
      expect.objectContaining({ updateGroupRobotId: true })
    );
    expect(res).toEqual({ task: { id: 't1' }, taskGroup: { id: 'g1', kind: 'chat', repoId: 'r1' } });
  });

  test('reuses an existing task group when taskGroupId is provided', async () => {
    const taskService: any = {
      getTaskGroup: jest.fn()
        .mockResolvedValueOnce({ id: 'g2', kind: 'issue', repoId: 'r1' })
        .mockResolvedValueOnce({ id: 'g2', kind: 'issue', repoId: 'r1' }),
      createManualTaskGroup: jest.fn(),
      createTaskInGroup: jest.fn().mockResolvedValue({ id: 't2' }),
      getTask: jest.fn().mockResolvedValue({ id: 't2' })
    };
    const repositoryService: any = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        provider: 'gitlab',
        name: 'group/project',
        apiBaseUrl: 'https://gitlab.example.com',
        externalId: '123',
        branches: [],
        enabled: true
      })
    };
    const repoRobotService: any = {
      getById: jest.fn().mockResolvedValue({ id: 'rb1', repoId: 'r1', name: 'robot', enabled: true, promptDefault: 'PROMPT' })
    };
    const taskRunner: any = {
      // Return a promise because ChatController now fire-and-forgets the dispatcher with `.catch(...)`. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      trigger: jest.fn().mockResolvedValue(undefined)
    };

    const controller = new ChatController(taskService, repositoryService, repoRobotService, taskRunner);

    const req = { user: { id: 'u2' } } as any; // Provide request user for actor attribution. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    const res = await controller.execute(req, { repoId: 'r1', robotId: 'rb1', taskGroupId: 'g2', text: 'hello' } as any);
    expect(taskService.createManualTaskGroup).not.toHaveBeenCalled();
    expect(taskService.createTaskInGroup).toHaveBeenCalledWith(
      'g2',
      'chat',
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ updateGroupRobotId: false })
    );
    expect(res).toEqual({ task: { id: 't2' }, taskGroup: { id: 'g2', kind: 'issue', repoId: 'r1' } });
  });

  test('returns a conflict when task creation is blocked by worker provider readiness', async () => {
    const taskService: any = {
      createManualTaskGroup: jest.fn().mockRejectedValue(
        new TaskCreationGuardError('WORKER_PROVIDER_NOT_READY', 'Codex is not prepared on remote-1. Prepare that runtime in the worker panel before starting the task.')
      )
    };
    const repositoryService: any = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        provider: 'gitlab',
        name: 'group/project',
        apiBaseUrl: 'https://gitlab.example.com',
        externalId: '123',
        branches: [],
        enabled: true
      })
    };
    const repoRobotService: any = {
      getById: jest.fn().mockResolvedValue({ id: 'rb1', repoId: 'r1', name: 'robot', enabled: true, promptDefault: 'PROMPT' })
    };
    const taskRunner: any = { trigger: jest.fn().mockResolvedValue(undefined) };
    const controller = new ChatController(taskService, repositoryService, repoRobotService, taskRunner);

    await expect(controller.execute({ user: { id: 'u1' } } as any, { repoId: 'r1', robotId: 'rb1', text: 'hello' } as any)).rejects.toMatchObject({
      response: {
        error: 'Codex is not prepared on remote-1. Prepare that runtime in the worker panel before starting the task.',
        code: 'WORKER_PROVIDER_NOT_READY'
      }
    });
  });
});
