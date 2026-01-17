import { DashboardController } from '../../modules/tasks/dashboard.controller';

// Unit tests for the dashboard sidebar snapshot endpoint. 7bqwou6abx4ste96ikhv

describe('DashboardController.sidebar', () => {
  test('returns a sanitized sidebar snapshot with permissions', async () => {
    const stats = { total: 3, queued: 1, processing: 1, success: 1, failed: 0 };
    const makeTask = (id: string, status: any) => ({
      id,
      eventType: 'chat',
      status,
      retries: 0,
      createdAt: '2026-01-17T00:00:00.000Z',
      updatedAt: '2026-01-17T00:00:00.000Z',
      result: { logs: ['secret'], outputText: 'hello\nworld\nmore' }
    });

    const taskService: any = {
      getTaskStats: jest.fn().mockResolvedValue(stats),
      listTasks: jest.fn().mockImplementation(async (options: any) => {
        if (options?.status === 'queued') return [makeTask('t_q1', 'queued')];
        if (options?.status === 'processing') return [makeTask('t_p1', 'processing')];
        if (options?.status === 'success') return [makeTask('t_s1', 'succeeded')];
        if (options?.status === 'failed') return [];
        return [];
      }),
      listTaskGroups: jest.fn().mockResolvedValue([{ id: 'g1', kind: 'chat', bindingKey: 'b1', createdAt: '', updatedAt: '' }])
    };

    const controller = new DashboardController(taskService);
    const res = await controller.sidebar(undefined, undefined, undefined, undefined, undefined);

    expect(taskService.getTaskStats).toHaveBeenCalledTimes(1);
    expect(taskService.listTasks).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued', limit: 3, includeMeta: true }));
    expect(taskService.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', limit: 3, includeMeta: true })
    );
    expect(taskService.listTasks).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', limit: 3, includeMeta: true }));
    expect(taskService.listTasks).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', limit: 3, includeMeta: true }));
    expect(taskService.listTaskGroups).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, includeMeta: true }));

    expect(res.stats).toEqual(stats);
    expect(res.tasksByStatus.queued[0].permissions).toEqual({ canManage: true });
    expect(res.tasksByStatus.queued[0].result?.logs).toBeUndefined();
    expect(res.tasksByStatus.queued[0].result?.outputText).toBeUndefined();
    expect(res.taskGroups).toHaveLength(1);
  });

  test('passes through query filters and custom limits', async () => {
    const taskService: any = {
      getTaskStats: jest.fn().mockResolvedValue({ total: 0, queued: 0, processing: 0, success: 0, failed: 0 }),
      listTasks: jest.fn().mockResolvedValue([]),
      listTaskGroups: jest.fn().mockResolvedValue([])
    };

    const controller = new DashboardController(taskService);
    await controller.sidebar('5', '10', 'repo_1', 'robot_1', 'push');

    expect(taskService.getTaskStats).toHaveBeenCalledWith(expect.objectContaining({ repoId: 'repo_1', robotId: 'robot_1', eventType: 'push' }));
    expect(taskService.listTasks).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, repoId: 'repo_1', robotId: 'robot_1', eventType: 'push' }));
    expect(taskService.listTaskGroups).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, repoId: 'repo_1', robotId: 'robot_1' }));
  });
});
