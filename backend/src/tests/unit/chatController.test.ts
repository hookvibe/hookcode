import { ChatController } from '../../modules/tasks/chat.controller';

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
    const taskRunner: any = { trigger: jest.fn() };

    const controller = new ChatController(taskService, repositoryService, repoRobotService, taskRunner);

    const res = await controller.execute({ repoId: 'r1', robotId: 'rb1', text: 'hello' } as any);
    expect(taskService.createManualTaskGroup).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'chat', repoId: 'r1', robotId: 'rb1' })
    );
    expect(taskService.createTaskInGroup).toHaveBeenCalledWith(
      'g1',
      'chat',
      expect.any(Object),
      expect.objectContaining({ repoId: 'r1', robotId: 'rb1', title: expect.stringContaining('Chat') }),
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
    const taskRunner: any = { trigger: jest.fn() };

    const controller = new ChatController(taskService, repositoryService, repoRobotService, taskRunner);

    const res = await controller.execute({ repoId: 'r1', robotId: 'rb1', taskGroupId: 'g2', text: 'hello' } as any);
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
});
