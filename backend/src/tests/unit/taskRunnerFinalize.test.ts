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

  const createWorkersConnectionService = () => ({
    // Keep TaskRunner tests focused on the external executor contract by stubbing worker socket dispatches. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    hasConnection: jest.fn().mockReturnValue(true),
    sendAssignTask: jest.fn().mockReturnValue(true),
    sendCancelTask: jest.fn().mockReturnValue(true)
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
    workersConnections?: any;
    workersService?: any;
  }) => {
    const taskService = params?.taskService ?? {};
    const taskLogsService = params?.taskLogsService ?? createTaskLogsService();
    const logWriter = params?.logWriter ?? createLogWriter();
    const notificationsService = params?.notificationsService ?? createNotificationsService();
    const notificationRecipients = params?.notificationRecipients ?? createNotificationRecipients();
    const workersConnections = params?.workersConnections ?? createWorkersConnectionService();
    const workersService = params?.workersService ?? createWorkersService();
    const runner = new TaskRunner(
      taskService as any,
      taskLogsService as any,
      {} as any,
      logWriter as any,
      notificationsService as any,
      notificationRecipients as any,
      workersConnections as any,
      workersService as any
    );
    return {
      runner,
      taskService,
      taskLogsService,
      logWriter,
      notificationsService,
      notificationRecipients,
      workersConnections,
      workersService
    };
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('dispatches a queued task to its assigned worker and reserves the worker slot', async () => {
    const task = createTask('t1', { status: 'queued' });
    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      patchResult: jest.fn().mockResolvedValue({ ...task, status: 'processing' } as any)
    };
    const taskLogsService = createTaskLogsService();
    const workersConnections = createWorkersConnectionService();
    const workersService = createWorkersService();
    const { runner } = createRunner({ taskService, taskLogsService, workersConnections, workersService });

    await runner.trigger();

    expect(taskLogsService.clearLogs).toHaveBeenCalledWith('t1');
    expect(taskService.patchResult).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ outputText: '' })
    );
    expect(workersService.reserveWorkerSlot).toHaveBeenCalledWith('worker-local');
    expect(workersConnections.sendAssignTask).toHaveBeenCalledWith('worker-local', 't1');
    expect(workersService.releaseWorkerSlot).not.toHaveBeenCalled();
  });

  test('marks the task failed when its assigned worker is disconnected', async () => {
    const task = createTask('t-disconnected', { status: 'queued' });
    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      patchResult: jest
        .fn()
        .mockResolvedValueOnce({ ...task, status: 'processing' } as any)
        .mockResolvedValueOnce({ ...task, status: 'failed' } as any)
    };
    const workersConnections = { ...createWorkersConnectionService(), sendAssignTask: jest.fn().mockReturnValue(false) };
    const workersService = createWorkersService();
    const { runner } = createRunner({ taskService, workersConnections, workersService });

    await runner.trigger();

    expect(workersService.reserveWorkerSlot).toHaveBeenCalledWith('worker-local');
    expect(workersService.releaseWorkerSlot).toHaveBeenCalledWith('worker-local');
    expect(taskService.patchResult).toHaveBeenLastCalledWith(
      't-disconnected',
      expect.objectContaining({ message: 'Assigned worker is not connected' }),
      'failed'
    );
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

  test('calls hooks on dispatch start and worker success finish', async () => {
    const events: string[] = [];
    const task = createTask('t-hooks', { status: 'queued' });
    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      patchResult: jest
        .fn()
        .mockResolvedValueOnce({ ...task, status: 'processing' } as any)
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

    await runner.trigger();
    await runner.reportWorkerSuccess(task, { durationMs: 12 });

    expect(events).toEqual(['start:t-hooks', 'finish:t-hooks:succeeded']);
  });

  test('starts multiple dispatches concurrently when WORKER_CONCURRENCY > 1', async () => {
    const prevConcurrency = process.env.WORKER_CONCURRENCY;
    process.env.WORKER_CONCURRENCY = '2';
    jest.useRealTimers();

    let resolveFirstPatch: ((value: unknown) => void) | undefined;
    let resolveSecondPatch: ((value: unknown) => void) | undefined;

    try {
      const task1 = createTask('t-concurrency-1', { status: 'queued' });
      const task2 = createTask('t-concurrency-2', { status: 'queued' });
      const taskService = {
        takeNextQueued: jest
          .fn()
          .mockResolvedValueOnce(task1)
          .mockResolvedValueOnce(task2)
          .mockResolvedValueOnce(undefined),
        patchResult: jest
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                resolveFirstPatch = resolve;
              })
          )
          .mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                resolveSecondPatch = resolve;
              })
          )
      };
      const { runner, workersConnections } = createRunner({ taskService, workersConnections: createWorkersConnectionService() });
      const triggerPromise = runner.trigger();

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // Assert both dispatches reach the pre-send patch stage before either one resolves, which proves queue concurrency. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      expect(taskService.patchResult).toHaveBeenCalledTimes(2);
      expect(workersConnections.sendAssignTask).toHaveBeenCalledTimes(0);

      resolveFirstPatch?.({ ...task1, status: 'processing' });
      resolveSecondPatch?.({ ...task2, status: 'processing' });
      await triggerPromise;

      expect(workersConnections.sendAssignTask).toHaveBeenCalledTimes(2);
    } finally {
      if (prevConcurrency === undefined) delete process.env.WORKER_CONCURRENCY;
      else process.env.WORKER_CONCURRENCY = prevConcurrency;
      jest.useFakeTimers();
    }
  });

  test('releases the reserved worker slot after local inline fallback execution', async () => {
    const task = createTask('t-inline-fallback');
    const logWriter = createLogWriter();
    const workersService = createWorkersService();
    const { runner } = createRunner({ logWriter, workersService });
    // Keep the inline-fallback test focused on slot release by spying on the shared execution path instead of rerunning agent logic. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const processTaskSpy = jest.spyOn(runner as any, 'processTask').mockResolvedValue(undefined);

    await runner.executeAssignedTaskInline(task);

    expect(processTaskSpy).toHaveBeenCalledWith(task);
    expect(workersService.releaseWorkerSlot).toHaveBeenCalledWith('worker-local');
    expect(logWriter.logSystem).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'WORKER_LOCAL_INLINE_FALLBACK',
        meta: expect.objectContaining({ taskId: 't-inline-fallback', workerId: 'worker-local' })
      })
    );
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
