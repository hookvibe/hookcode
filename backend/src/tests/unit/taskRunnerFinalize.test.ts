export {};

jest.useFakeTimers();

jest.mock('../../agent/agent', () => {
  class AgentExecutionError extends Error {
    logs: string[];
    logsSeq: number;
    providerCommentUrl?: string;
    constructor(message: string, params: { logs: string[]; logsSeq: number; providerCommentUrl?: string; cause?: unknown }) {
      super(message);
      this.name = 'AgentExecutionError';
      this.logs = params.logs;
      this.logsSeq = params.logsSeq;
      this.providerCommentUrl = params.providerCommentUrl;
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
    expect(taskService.patchResult).toHaveBeenLastCalledWith('t2', { logs: ['ok'], outputText: 'OUT' }, 'succeeded');
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
});
