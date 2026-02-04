import { Injectable } from '@nestjs/common';
import { AgentExecutionError } from '../../agent/agent';
import { Task, type TaskResult, type TaskStatus } from '../../types/task';
import { AgentService } from './agent.service';
import { TaskService } from './task.service';

export interface TaskRunnerFinishInfo {
  status: TaskStatus;
  message?: string;
  providerCommentUrl?: string;
  durationMs?: number;
}

export interface TaskRunnerHooks {
  onTaskStart?: (task: Task) => void | Promise<void>;
  onTaskFinish?: (task: Task, info: TaskRunnerFinishInfo) => void | Promise<void>;
}

/**
 * Queue runner (serially consumes tasks):
 * - Triggered periodically by `backend/src/worker.ts`, or triggered in INLINE_WORKER mode by `backend/src/routes/webhook.ts` / `backend/src/routes/tasks.ts`.
 * - Pulls one queued task via `TaskService.takeNextQueued()` and marks it processing; updates status to succeeded/failed when done.
 * - The actual "execute task" logic lives in `backend/src/agent/agent.ts` (callAgent: clone repo, build prompt, run codex, post back to GitLab).
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type TaskAbortReason = 'paused' | 'deleted';

// Poll task control state so workers can pause/stop running tasks. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
const TASK_CONTROL_POLL_INTERVAL_MS = 2000;

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

@Injectable()
export class TaskRunner {
  private running = false;
  private pending = false;
  private hooks: TaskRunnerHooks | null = null;

  constructor(private readonly taskService: TaskService, private readonly agentService: AgentService) {}

  setHooks(hooks: TaskRunnerHooks | null): void {
    this.hooks = hooks;
  }

  /**
   * Trigger queue processing. Keep a single instance running serially.
   */
  async trigger(): Promise<void> {
    if (this.running) {
      this.pending = true;
      return;
    }

    this.running = true;
    try {
      do {
        this.pending = false;
        await this.runLoop();
      } while (this.pending);
    } finally {
      this.running = false;
    }
  }

  private async runLoop(): Promise<void> {
    // Keep pulling from the queue until there are no pending tasks.
    while (true) {
      const task = await this.taskService.takeNextQueued();
      if (!task) break;
      await this.processTask(task);
    }
  }

  private startControlPolling(taskId: string, onAbort: (reason: TaskAbortReason) => void): () => void {
    // Poll DB status so pause/delete requests can stop active executions. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const state = await this.taskService.getTaskControlState(taskId);
        if (!state) {
          onAbort('deleted');
          return;
        }
        if (state.status === 'paused') {
          onAbort('paused');
        }
      } catch (err) {
        console.warn('[taskRunner] control poll failed (ignored)', taskId, err);
      }
    };

    const timer = setInterval(poll, TASK_CONTROL_POLL_INTERVAL_MS);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }

  private async runHookStart(task: Task): Promise<void> {
    const fn = this.hooks?.onTaskStart;
    if (!fn) return;
    try {
      await fn(task);
    } catch (err) {
      console.warn('[taskRunner] onTaskStart hook failed (ignored)', task.id, err);
    }
  }

  private async runHookFinish(task: Task, info: TaskRunnerFinishInfo): Promise<void> {
    const fn = this.hooks?.onTaskFinish;
    if (!fn) return;
    try {
      await fn(task, info);
    } catch (err) {
      console.warn('[taskRunner] onTaskFinish hook failed (ignored)', task.id, err);
    }
  }

  private async processTask(task: Task): Promise<void> {
    const startedAt = Date.now();
    await this.runHookStart(task);

    let abortReason: TaskAbortReason | null = null;
    const abortController = new AbortController();
    const requestAbort = (reason: TaskAbortReason) => {
      if (abortController.signal.aborted) return;
      abortReason = reason;
      // Abort in-flight providers so pause/delete requests stop execution quickly. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      abortController.abort(new Error(`task_${reason}`));
    };
    const stopControlPolling = this.startControlPolling(task.id, requestAbort);

    try {
      try {
        await this.taskService.patchResult(task.id, {
          outputText: '',
          logs: [],
          logsSeq: 0,
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        });
      } catch (err) {
        console.warn('[taskRunner] pre-run outputText reset failed', task.id, err);
      }

      // Persist git status alongside logs/output so the UI can display change tracking. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const { logs, logsSeq, providerCommentUrl, outputText, gitStatus } = await this.agentService.callAgent(task, {
        signal: abortController.signal
      });
      await this.finalizeWithRetry(task.id, 'succeeded', { logs, logsSeq, providerCommentUrl, outputText, gitStatus });
      await this.runHookFinish(task, {
        status: 'succeeded',
        providerCommentUrl,
        durationMs: Date.now() - startedAt
      });
    } catch (err) {
      const logs = err instanceof AgentExecutionError ? err.logs : [];
      const logsSeq = err instanceof AgentExecutionError ? err.logsSeq : undefined;
      const providerCommentUrl = err instanceof AgentExecutionError ? err.providerCommentUrl : undefined;
      // Preserve git status on failed runs so the UI can show unpushed changes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const gitStatus = err instanceof AgentExecutionError ? err.gitStatus : undefined;
      const message = getErrorMessage(err);

      if (!abortReason && err instanceof AgentExecutionError && err.aborted) {
        // Treat provider aborts as pause requests when no explicit reason is tracked. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
        abortReason = 'paused';
      }

      if (abortReason === 'paused') {
        const pauseMessage = 'Task paused by user.';
        await this.finalizeWithRetry(task.id, 'paused', {
          logs,
          logsSeq,
          message: pauseMessage,
          providerCommentUrl,
          gitStatus
        });
        await this.runHookFinish(task, {
          status: 'paused',
          message: pauseMessage,
          providerCommentUrl,
          durationMs: Date.now() - startedAt
        });
        return;
      }

      if (abortReason === 'deleted') {
        console.warn('[taskRunner] task removed during execution; skip finalize', task.id);
        await this.runHookFinish(task, {
          status: 'failed',
          message: 'Task deleted during execution.',
          providerCommentUrl,
          durationMs: Date.now() - startedAt
        });
        return;
      }

      console.error('[taskRunner] task failed', task.id, err);
      await this.finalizeWithRetry(task.id, 'failed', { logs, logsSeq, message, providerCommentUrl, gitStatus });
      await this.runHookFinish(task, {
        status: 'failed',
        message,
        providerCommentUrl,
        durationMs: Date.now() - startedAt
      });
    } finally {
      stopControlPolling();
    }
  }

  private async finalizeWithRetry(taskId: string, status: TaskStatus, patch: Partial<TaskResult>): Promise<void> {
    let attempt = 0;
    let lastLogAt = 0;
    while (true) {
      attempt += 1;
      try {
        const updated = await this.taskService.patchResult(taskId, patch, status);
        if (!updated) return;
        return;
      } catch (err) {
        const waitMs = Math.min(30_000, 500 * 2 ** Math.min(attempt, 6));
        const now = Date.now();
        if (attempt <= 2 || now - lastLogAt > 30_000) {
          lastLogAt = now;
          console.error('[taskRunner] finalize failed; retrying', { taskId, status, attempt, waitMs }, err);
        }
        await sleep(waitMs);
      }
    }
  }
}
