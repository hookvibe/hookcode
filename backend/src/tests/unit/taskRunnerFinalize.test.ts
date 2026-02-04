export {};

jest.useFakeTimers();

jest.mock('../../agent/agent', () => {
  class AgentExecutionError extends Error {
    logs: string[];
    logsSeq: number;
    providerCommentUrl?: string;
    // Expose abort markers for pause/resume TaskRunner coverage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    aborted?: boolean;
    // Mirror AgentExecutionError shape to include git status payloads. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    gitStatus?: unknown;
    constructor(
      message: string,
      params: {
        logs: string[];
        logsSeq: number;
        providerCommentUrl?: string;
        gitStatus?: unknown;
        cause?: unknown;
        aborted?: boolean;
      }
    ) {
      super(message);
      this.name = 'AgentExecutionError';
      this.logs = params.logs;
      this.logsSeq = params.logsSeq;
      this.providerCommentUrl = params.providerCommentUrl;
      // Keep abort flag aligned with pause/resume error handling. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      this.aborted = params.aborted;
      this.gitStatus = params.gitStatus;
      if (params.cause !== undefined) {
        (this as any).cause = params.cause;
      }
    }
  }

  return {
    __esModule: true,
    AgentExecutionError
  };
});

import { AgentExecutionError } from '../../agent/agent';
import { TaskRunner } from '../../modules/tasks/task-runner.service';

describe('TaskRunner (finalization + DB write retry)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('retries patchResult with backoff when the first DB write fails (failed task)', async () => {
    const task = {
      id: 't1',
      eventType: 'commit',
      status: 'processing',
      payload: {},
      retries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const agentService = {
      callAgent: jest.fn().mockRejectedValueOnce(new AgentExecutionError('boom', { logs: ['l1'], logsSeq: 0, cause: new Error('boom') }))
    };

    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      patchResult: jest
        .fn()
        .mockResolvedValueOnce({ ...task, status: 'processing' } as any) // pre-run outputText reset
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce({ ...task, status: 'failed' } as any)
    };

    const taskRunner = new TaskRunner(taskService as any, agentService as any);

    const promise = taskRunner.trigger();
    await Promise.resolve();
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    expect(taskService.takeNextQueued).toHaveBeenCalled();
    expect(taskService.patchResult).toHaveBeenCalledTimes(3);
    expect(taskService.patchResult).toHaveBeenLastCalledWith(
      't1',
      expect.objectContaining({ logs: ['l1'], message: 'boom' }),
      'failed'
    );
  });

  test('writes logs once and marks succeeded (successful task)', async () => {
    const task = {
      id: 't2',
      eventType: 'commit',
      status: 'processing',
      payload: {},
      retries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const agentService = {
      callAgent: jest.fn().mockResolvedValueOnce({ logs: ['ok'], outputText: 'OUT' })
    };

    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      patchResult: jest
        .fn()
        .mockResolvedValueOnce({ ...task, status: 'processing' } as any) // pre-run outputText reset
        .mockResolvedValueOnce({ ...task, status: 'succeeded' } as any)
    };

    const taskRunner = new TaskRunner(taskService as any, agentService as any);

    await taskRunner.trigger();

    expect(taskService.patchResult).toHaveBeenCalledTimes(2);
    // Allow extra result fields (e.g., gitStatus) without breaking this regression test. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    expect(taskService.patchResult).toHaveBeenLastCalledWith(
      't2',
      expect.objectContaining({ logs: ['ok'], outputText: 'OUT' }),
      'succeeded'
    );
  });

  test('calls hooks on start and finish (success)', async () => {
    const events: string[] = [];

    const task = {
      id: 't3',
      eventType: 'commit',
      status: 'processing',
      payload: {},
      retries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const agentService = {
      callAgent: jest.fn().mockResolvedValueOnce({ logs: ['ok'], outputText: 'OUT' })
    };

    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      patchResult: jest
        .fn()
        .mockResolvedValueOnce({ ...task, status: 'processing' } as any)
        .mockResolvedValueOnce({ ...task, status: 'succeeded' } as any)
    };

    const taskRunner = new TaskRunner(taskService as any, agentService as any);
    taskRunner.setHooks({
      onTaskStart: (t) => {
        events.push(`start:${t.id}`);
      },
      onTaskFinish: (t, info) => {
        events.push(`finish:${t.id}:${info.status}`);
      }
    });

    await taskRunner.trigger();

    expect(events).toEqual(['start:t3', 'finish:t3:succeeded']);
  });

  test('calls hooks on start and finish (failure)', async () => {
    const events: string[] = [];

    const task = {
      id: 't4',
      eventType: 'commit',
      status: 'processing',
      payload: {},
      retries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const agentService = {
      callAgent: jest.fn().mockRejectedValueOnce(new Error('boom'))
    };

    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      patchResult: jest
        .fn()
        .mockResolvedValueOnce({ ...task, status: 'processing' } as any)
        .mockResolvedValueOnce({ ...task, status: 'failed' } as any)
    };

    const taskRunner = new TaskRunner(taskService as any, agentService as any);
    taskRunner.setHooks({
      onTaskStart: (t) => {
        events.push(`start:${t.id}`);
      },
      onTaskFinish: (t, info) => {
        events.push(`finish:${t.id}:${info.status}:${info.message ?? ''}`);
      }
    });

    await taskRunner.trigger();

    expect(events).toEqual(['start:t4', 'finish:t4:failed:boom']);
  });

  // Simulate pause polling to ensure TaskRunner finalizes with paused status. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  test('marks task paused when control polling requests abort', async () => {
    const task = {
      id: 't_pause',
      eventType: 'commit',
      status: 'processing',
      payload: {},
      retries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const agentService = {
      callAgent: jest.fn((_: any, options: { signal?: AbortSignal }) => {
        // Reject on AbortSignal so the TaskRunner can finalize paused tasks. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
        return new Promise((_, reject) => {
          const err = new AgentExecutionError('aborted', { logs: [], logsSeq: 0, aborted: true });
          if (options?.signal?.aborted) {
            reject(err);
            return;
          }
          options?.signal?.addEventListener('abort', () => reject(err));
        });
      })
    };

    const taskService = {
      takeNextQueued: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(undefined),
      getTaskControlState: jest.fn().mockResolvedValue({ status: 'paused', archivedAt: null }),
      patchResult: jest.fn().mockResolvedValue({ ...task, status: 'processing' } as any)
    };

    const taskRunner = new TaskRunner(taskService as any, agentService as any);
    const promise = taskRunner.trigger();

    await Promise.resolve();
    await Promise.resolve();
    await promise;

    expect(taskService.getTaskControlState).toHaveBeenCalled();
    expect(taskService.patchResult).toHaveBeenLastCalledWith(
      't_pause',
      expect.objectContaining({ message: 'Task paused by user.' }),
      'paused'
    );
  });
});
