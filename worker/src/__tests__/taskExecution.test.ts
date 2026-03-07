// Verify local workers delegate missing-command tasks back to backend inline execution without writing conflicting worker log batches. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
import path from 'path';
import { runTaskExecution } from '../runtime/taskExecution';

describe('runTaskExecution', () => {
  test('delegates local tasks to backend inline execution when no command is resolved', async () => {
    const client = {
      ensureGroupId: jest.fn().mockResolvedValue({ groupId: 'group-1' }),
      getThreadId: jest.fn().mockResolvedValue({ threadId: null }),
      getTaskGroupHistory: jest.fn().mockResolvedValue({ hasPriorTaskGroupTask: false, hasTaskGroupLogs: false }),
      getTaskGroupSkills: jest.fn().mockResolvedValue({ selection: null }),
      getPromptPrefix: jest.fn().mockResolvedValue({ promptPrefix: '' }),
      executeInlineTask: jest.fn().mockResolvedValue({ success: true }),
      appendLogs: jest.fn().mockResolvedValue({ success: true })
    };

    const result = await runTaskExecution({
      client: client as any,
      config: {
        backendUrl: 'http://127.0.0.1:4020/api',
        wsUrl: 'ws://127.0.0.1:4020/api/workers/connect?workerId=worker-1&token=secret',
        workerId: 'worker-1',
        workerToken: 'secret',
        workerName: 'Local Worker',
        workerKind: 'local',
        preview: true,
        heartbeatIntervalMs: 10_000,
        maxConcurrency: 1,
        runtimeInstallDir: path.resolve('/tmp', 'hookcode-runtime'),
        workspaceRootDir: path.resolve('/tmp', 'hookcode-workspaces'),
        reconnectMinMs: 100,
        reconnectMaxMs: 1_000,
        controlPollIntervalMs: 2_000,
        cancelKillTimeoutMs: 5_000,
        noopOnMissingCommand: false
      },
      context: {
        task: {
          id: 'task-1',
          taskGroupId: 'group-1',
          repoId: 'repo-1'
        }
      },
      taskId: 'task-1',
      signal: new AbortController().signal
    });

    expect(result).toEqual({ handledByBackend: true });
    expect(client.executeInlineTask).toHaveBeenCalledWith('task-1');
    expect(client.appendLogs).not.toHaveBeenCalled();
  });
});
