import { mkdir } from 'fs/promises';
import { spawn } from 'child_process';
import { BackendInternalApiClient, WorkerTaskContextResponse } from '../backend/internalApiClient';
import type { WorkerConfig } from '../config';
import { TaskLogBatcher } from './logBatcher';
import {
  buildTaskEnvironment,
  HydratedTaskMetadata,
  resolveTaskCommand,
  resolveTaskWorkspaceDir,
  summarizeInjectedEnvironment
} from './taskCommand';

export interface TaskExecutionSuccess {
  outputText?: string;
  gitStatus?: Record<string, unknown>;
  providerCommentUrl?: string;
  // Mark backend-inline fallback completions so WorkerProcess skips duplicate finalization after the local worker delegates execution. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  handledByBackend?: boolean;
}

const MANUAL_STOP_MESSAGE = 'Task execution stopped by worker cancellation.';
const TASK_DELETED_MESSAGE = 'Task was deleted while the worker was executing it.';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const createLineWriter = (batcher: TaskLogBatcher) => {
  let seq = 0;
  return (line: string): void => {
    const safeLine = line.replace(/\r/g, '');
    if (!safeLine) return;
    batcher.add(++seq, safeLine);
  };
};

const writeBufferedOutput = (writeLine: (line: string) => void, chunk: Buffer | string, buffer: { value: string }): void => {
  const text = buffer.value + String(chunk);
  const lines = text.split(/\n/);
  buffer.value = lines.pop() ?? '';
  for (const line of lines) {
    writeLine(line);
  }
};

const flushBufferedOutput = (writeLine: (line: string) => void, buffer: { value: string }): void => {
  if (!buffer.value) return;
  writeLine(buffer.value);
  buffer.value = '';
};

const resolveAbortMessage = (stopReason?: 'manual_stop' | 'deleted'): string => {
  return stopReason === 'deleted' ? TASK_DELETED_MESSAGE : MANUAL_STOP_MESSAGE;
};

const hydrateTaskMetadata = async (
  client: BackendInternalApiClient,
  taskId: string,
  task: Record<string, unknown> | null | undefined
): Promise<HydratedTaskMetadata> => {
  const groupIdFromTask = trimString(task?.taskGroupId);
  const ensuredGroup = groupIdFromTask ? { groupId: groupIdFromTask } : await client.ensureGroupId(taskId);
  const groupId = trimString(ensuredGroup.groupId);
  if (!groupId) return {};

  // Pull task-group scoped metadata through backend APIs so external workers can receive runner-style injected variables without DB access. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const [threadResponse, historyResponse, skillsResponse] = await Promise.all([
    client.getThreadId(groupId),
    client.getTaskGroupHistory(groupId, taskId),
    client.getTaskGroupSkills(groupId)
  ]);
  const promptPrefixResponse = await client.getPromptPrefix(skillsResponse.selection ?? null);
  return {
    groupId,
    threadId: threadResponse.threadId,
    hasPriorTaskGroupTask: historyResponse.hasPriorTaskGroupTask,
    hasTaskGroupLogs: historyResponse.hasTaskGroupLogs,
    skillSelection: skillsResponse.selection,
    promptPrefix: promptPrefixResponse.promptPrefix
  };
};

const executeShellCommand = async (params: {
  command: string;
  env: Record<string, string>;
  cwd: string;
  signal: AbortSignal;
  killTimeoutMs: number;
  writeLine: (line: string) => void;
}): Promise<{ outputText?: string }> => {
  const stdoutBuffer = { value: '' };
  const stderrBuffer = { value: '' };
  const tail: string[] = [];
  const rememberLine = (line: string): void => {
    tail.push(line);
    if (tail.length > 80) tail.shift();
    params.writeLine(line);
  };

  await new Promise<void>((resolve, reject) => {
    const child = spawn(params.command, {
      cwd: params.cwd,
      env: params.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let killedByAbort = false;
    let killTimer: NodeJS.Timeout | null = null;

    const stopChild = () => {
      if (killedByAbort) return;
      killedByAbort = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        child.kill('SIGKILL');
      }, params.killTimeoutMs);
    };

    if (params.signal.aborted) {
      stopChild();
    } else {
      params.signal.addEventListener('abort', stopChild, { once: true });
    }

    child.stdout?.on('data', (chunk) => writeBufferedOutput(rememberLine, chunk, stdoutBuffer));
    child.stderr?.on('data', (chunk) => writeBufferedOutput(rememberLine, chunk, stderrBuffer));
    child.once('error', (error) => {
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (killTimer) clearTimeout(killTimer);
      flushBufferedOutput(rememberLine, stdoutBuffer);
      flushBufferedOutput(rememberLine, stderrBuffer);
      if (killedByAbort) {
        reject(new Error(`Task execution aborted (${signal ?? 'signal'})`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Task command exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`));
    });
  });

  return { outputText: tail.join('\n') || undefined };
};

export const runTaskExecution = async (params: {
  client: BackendInternalApiClient;
  config: WorkerConfig;
  context: WorkerTaskContextResponse;
  taskId: string;
  signal: AbortSignal;
  stopReason?: 'manual_stop' | 'deleted';
}): Promise<TaskExecutionSuccess> => {
  const batcher = new TaskLogBatcher(params.client, params.taskId);
  const writeLine = createLineWriter(batcher);

  try {
    const task = params.context.task ?? {};
    const metadata = await hydrateTaskMetadata(params.client, params.taskId, task);
    const workspaceDir = resolveTaskWorkspaceDir(params.config.workspaceRootDir, task, metadata);
    await mkdir(workspaceDir, { recursive: true });

    const resolvedCommand = resolveTaskCommand(task, params.config, metadata);

    if (!resolvedCommand && params.config.workerKind === 'local') {
      // Delegate missing-command local tasks back to backend inline execution so the supervised worker stays functional while the remote-safe executor envelope is still landing. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      await params.client.executeInlineTask(params.taskId);
      return { handledByBackend: true };
    }

    const env = buildTaskEnvironment({
      config: params.config,
      context: params.context,
      metadata,
      workspaceDir
    });
    const envSummary = summarizeInjectedEnvironment(env);

    writeLine(`[worker] task ${params.taskId} workspace: ${workspaceDir}`);
    writeLine(`[worker] injected env vars: ${envSummary.count}`);
    if (envSummary.redactedKeys.length > 0) {
      writeLine(`[worker] redacted secret-like env keys: ${envSummary.redactedKeys.join(', ')}`);
    }

    if (!resolvedCommand) {
      const message = 'No task command was resolved from env or task payload.';
      writeLine(`[worker] ${message}`);
      if (params.config.noopOnMissingCommand) {
        // Allow explicit noop mode for smoke tests so the standalone worker can validate wiring before the full agent runtime lands. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
        writeLine('[worker] noop mode is enabled; reporting success without spawning a task command.');
        return { outputText: message };
      }
      throw new Error(message);
    }

    writeLine(`[worker] task command source: ${resolvedCommand.source}`);
    await params.client.patchResult(
      params.taskId,
      {
        message: `Worker started command from ${resolvedCommand.source}`,
        workerCommandSource: resolvedCommand.source
      },
      'processing'
    );

    return await executeShellCommand({
      command: resolvedCommand.command,
      env,
      cwd: workspaceDir,
      signal: params.signal,
      killTimeoutMs: params.config.cancelKillTimeoutMs,
      writeLine
    });
  } catch (error) {
    if (params.signal.aborted) {
      throw new Error(resolveAbortMessage(params.stopReason));
    }
    throw error;
  } finally {
    await batcher.close();
  }
};
