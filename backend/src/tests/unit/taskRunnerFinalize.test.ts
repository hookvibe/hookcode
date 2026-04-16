export {};

jest.useFakeTimers();

import { TaskRunner } from '../../modules/tasks/task-runner.service';

describe('TaskRunner (worker dispatch + finalization)', () => {
  const createLogWriter = () => ({
    logExecution: jest.fn().mockResolvedValue(undefined),
    logOperation: jest.fn().mockResolvedValue(undefined),
    logSystem: jest.fn().mockResolvedValue(undefined)
  }); // Provide a noop log writer for TaskRunner audit hooks. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

  const createNotificationsService = () => ({
    createNotification: jest.fn().mockResolvedValue(undefined)
  }); // Provide notification stubs for TaskRunner tests. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302

  const createNotificationRecipients = () => ({
    resolveRecipientsForTask: jest.fn().mockResolvedValue([])
  }); // Provide recipient stubs for TaskRunner tests. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302

  const createTaskLogsService = () => ({
    // Stub task log storage for pre-run log resets. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    clearLogs: jest.fn().mockResolvedValue(0)
  });

  const createWorkersService = () => ({
    // Provide worker-slot bookkeeping stubs so TaskRunner tests stay isolated from registry persistence. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    reserveWorkerSlot: jest.fn().mockResolvedValue(undefined),
    releaseWorkerSlot: jest.fn().mockResolvedValue(undefined)
  });

  const createTask = (id: string, overrides: Record<string, unknown> = {}) => ({
    // Keep task fixtures aligned with the worker-bound execution model by assigning a worker id in every test. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    id,
    title: `Task ${id}`,
    workerId: 'worker-local',
    eventType: 'commit',
    status: 'processing',
    payload: {},
    retries: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }) as any;

  const createRunner = (params?: {
    taskService?: any;
    taskLogsService?: any;
    logWriter?: any;
    notificationsService?: any;
    notificationRecipients?: any;
    workersService?: any;
  }) => {
    const taskService = params?.taskService ?? {};
    const taskLogsService = params?.taskLogsService ?? createTaskLogsService();
    const logWriter = params?.logWriter ?? createLogWriter();
    const notificationsService = params?.notificationsService ?? createNotificationsService();
    const notificationRecipients = params?.notificationRecipients ?? createNotificationRecipients();
    const workersService = params?.workersService ?? createWorkersService();
    const runner = new TaskRunner(
      taskService as any,
      taskLogsService as any,
      logWriter as any,
      notificationsService as any,
      notificationRecipients as any,
      workersService as any
    );
    return {
      runner,
      taskService,
      taskLogsService,
      logWriter,
      notificationsService,
      notificationRecipients,
      workersService
    };
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('retries patchResult with backoff when reportWorkerFailure cannot persist on the first attempt', async () => {
    const task = createTask('t-fail');
    const taskService = {
      patchResult: jest
        .fn()
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce({ ...task, status: 'failed' } as any)
    };
    const workersService = createWorkersService();
    const { runner } = createRunner({ taskService, workersService });

    const promise = runner.reportWorkerFailure(task, { message: 'boom' });
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    expect(taskService.patchResult).toHaveBeenCalledTimes(2);
    expect(taskService.patchResult).toHaveBeenLastCalledWith(
      't-fail',
      expect.objectContaining({ message: 'boom' }),
      'failed'
    );
    expect(workersService.releaseWorkerSlot).toHaveBeenCalledWith('worker-local');
  });

  test('writes outputText once and marks succeeded when the worker reports success', async () => {
    const task = createTask('t-success');
    const taskService = {
      patchResult: jest.fn().mockResolvedValueOnce({ ...task, status: 'succeeded' } as any)
    };
    const workersService = createWorkersService();
    const { runner } = createRunner({ taskService, workersService });

    await runner.reportWorkerSuccess(task, { outputText: 'OUT' });

    expect(taskService.patchResult).toHaveBeenCalledTimes(1);
    expect(taskService.patchResult).toHaveBeenLastCalledWith(
      't-success',
      expect.objectContaining({ outputText: 'OUT' }),
      'succeeded'
    );
    expect(workersService.releaseWorkerSlot).toHaveBeenCalledWith('worker-local');
  });

  test('creates task-detail notification links when worker success notifications are emitted', async () => {
    const task = createTask('t-notify-link', {
      repoId: 'r1',
      groupId: 'g1',
      actorUserId: 'u1'
    });
    const taskService = {
      patchResult: jest.fn().mockResolvedValueOnce({ ...task, status: 'succeeded' } as any)
    };
    const notificationsService = createNotificationsService();
    const notificationRecipients = {
      resolveRecipientsForTask: jest.fn().mockResolvedValue(['u1'])
    };
    const { runner } = createRunner({ taskService, notificationsService, notificationRecipients });

    await runner.reportWorkerSuccess(task, { providerCommentUrl: 'https://example.com/comment/1', durationMs: 12 });
    await Promise.resolve();
    await Promise.resolve();

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        taskId: 't-notify-link',
        taskGroupId: 'g1',
        linkUrl: '#/tasks/t-notify-link'
      })
    );
  });

  test('calls hooks on worker success finish', async () => {
    const events: string[] = [];
    const task = createTask('t-hooks');
    const taskService = {
      patchResult: jest
        .fn()
        .mockResolvedValueOnce({ ...task, status: 'succeeded' } as any)
    };
    const { runner } = createRunner({ taskService });
    runner.setHooks({
      onTaskStart: (nextTask) => {
        events.push(`start:${nextTask.id}`);
      },
      onTaskFinish: (nextTask, info) => {
        events.push(`finish:${nextTask.id}:${info.status}`);
      }
    });

    await runner.reportWorkerSuccess(task, { durationMs: 12 });

    expect(events).toEqual(['finish:t-hooks:succeeded']);
  });

  test('marks manual-stop worker reports as failed with the stop message', async () => {
    const task = createTask('t-stop');
    const taskService = {
      patchResult: jest.fn().mockResolvedValueOnce({ ...task, status: 'failed' } as any)
    };
    const { runner } = createRunner({ taskService });

    await runner.reportWorkerFailure(task, { message: 'ignored', stopReason: 'manual_stop' });

    expect(taskService.patchResult).toHaveBeenLastCalledWith(
      't-stop',
      expect.objectContaining({ message: 'Task stopped manually.' }),
      'failed'
    );
  });
});
