import { Injectable } from '@nestjs/common';
import { AgentExecutionError } from '../../agent/agent';
import { Task, type TaskResult, type TaskStatus } from '../../types/task';
import { AgentService } from './agent.service';
import { TaskService } from './task.service';
import { TaskLogsService } from './task-logs.service';
import { LogWriterService } from '../logs/log-writer.service';
import { buildNotificationLinkUrl } from '../notifications/notification-links';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationRecipientService } from '../notifications/notification-recipient.service';
import { TASK_MANUAL_STOP_MESSAGE } from './task-control.constants';
import { WorkersConnectionService } from '../workers/workers-connection.service';
import { WorkersService } from '../workers/workers.service';
import { normalizeBudgetExecutionOverride } from '../../costGovernance/types';

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
 * Queue runner (consumes tasks in parallel across task groups). docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
 * - Triggered by backend queue mutations so connected external workers receive assignments without polling the database. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
 * - Pulls one queued task via `TaskService.takeNextQueued()` and marks it processing; updates status to succeeded/failed when done.
 * - The actual "execute task" logic lives in `backend/src/agent/agent.ts` (callAgent: clone repo, build prompt, run codex, post back to GitLab).
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type TaskAbortReason = 'manual_stop' | 'deleted' | 'runtime_limit';
const TASK_RUNTIME_LIMIT_MESSAGE = 'Task stopped after reaching the configured runtime limit.';

// Poll task control state so workers can stop running tasks without a resumable paused state. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
const TASK_CONTROL_POLL_INTERVAL_MS = 2000;

const resolveWorkerConcurrency = (): number => {
  // Bound worker parallelism for task-group execution while allowing config overrides. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
  const raw = Number(process.env.WORKER_CONCURRENCY ?? '');
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  return 2;
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const buildTaskLabel = (task: Task): string => {
  // Compose stable task labels for notification messages. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  return task.title ? task.title : `Task ${task.id}`;
};

@Injectable()
export class TaskRunner {
  private running = false;
  private pending = false;
  private hooks: TaskRunnerHooks | null = null;
  // Configure per-process task concurrency to enable parallel task-group runs. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
  private readonly maxConcurrency = resolveWorkerConcurrency();

  constructor(
    private readonly taskService: TaskService,
    private readonly taskLogsService: TaskLogsService, // Clear task log rows before each run to reset history. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    private readonly agentService: AgentService,
    private readonly logWriter: LogWriterService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationRecipients: NotificationRecipientService,
    private readonly workersConnections: WorkersConnectionService,
    private readonly workersService: WorkersService
  ) {}

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
    // Run up to maxConcurrency tasks in parallel while the queue has eligible tasks. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
    const running = new Set<Promise<void>>();

    const startTask = (task: Task) => {
      const work = this.dispatchTask(task).catch((err) => {
        console.error('[taskRunner] dispatchTask failed', task.id, err);
      });
      running.add(work);
      work.finally(() => running.delete(work));
    };

    while (true) {
      while (running.size < this.maxConcurrency) {
        const task = await this.taskService.takeNextQueued();
        if (!task) break;
        startTask(task);
      }

      if (running.size === 0) break;
      await Promise.race(running);
    }
  }

  private startControlPolling(taskId: string, onAbort: (reason: TaskAbortReason) => void): () => void {
    // Poll DB control flags so stop/delete requests can abort active executions quickly. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const state = await this.taskService.getTaskControlState(taskId);
        if (!state) {
          onAbort('deleted');
          return;
        }
        if (state.stopRequested) {
          onAbort('manual_stop');
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

  private async dispatchTask(task: Task): Promise<void> {
    const startedAt = Date.now();
    await this.runHookStart(task);
    // Emit dispatch-start logs before handing the task to a connected worker so admin timelines stay complete. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    void this.logWriter.logExecution({
      level: 'info',
      message: 'Task dispatched',
      code: 'TASK_DISPATCHED',
      repoId: task.repoId,
      taskId: task.id,
      taskGroupId: task.groupId,
      meta: { eventType: task.eventType, robotId: task.robotId, retries: task.retries, workerId: task.workerId }
    });

    try {
      await this.taskLogsService.clearLogs(task.id);
      await this.taskService.patchResult(task.id, {
        outputText: '',
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      });
      const workerId = task.workerId ?? '';
      if (!workerId) throw new Error('Task is missing worker assignment');
      await this.workersService.reserveWorkerSlot(workerId);
      const dispatched = this.workersConnections.sendAssignTask(workerId, task.id);
      if (!dispatched) {
        await this.workersService.releaseWorkerSlot(workerId);
        throw new Error('Assigned worker is not connected');
      }
    } catch (err) {
      await this.reportWorkerFailure(task, {
        message: getErrorMessage(err),
        durationMs: Date.now() - startedAt
      });
    }
  }

  async reportWorkerSuccess(
    task: Task,
    params: { providerCommentUrl?: string; outputText?: string; gitStatus?: TaskResult['gitStatus']; durationMs?: number }
  ): Promise<void> {
    try {
      await this.finalizeWithRetry(task.id, 'succeeded', {
        providerCommentUrl: params.providerCommentUrl,
        outputText: params.outputText,
        gitStatus: params.gitStatus
      });
      // Record successful worker completions with the same audit and notification semantics as local execution. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      void this.logWriter.logExecution({
        level: 'info',
        message: 'Task succeeded',
        code: 'TASK_SUCCEEDED',
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { durationMs: params.durationMs ?? 0, retries: task.retries, workerId: task.workerId }
      });
      void this.emitTaskNotification(task, {
        type: 'TASK_SUCCEEDED',
        level: 'info',
        message: `Task succeeded: ${buildTaskLabel(task)}`,
        code: 'TASK_SUCCEEDED',
        externalUrl: params.providerCommentUrl,
        meta: { durationMs: params.durationMs ?? 0, retries: task.retries, workerId: task.workerId }
      });
      await this.runHookFinish(task, {
        status: 'succeeded',
        providerCommentUrl: params.providerCommentUrl,
        durationMs: params.durationMs
      });
    } finally {
      if (task.workerId) await this.workersService.releaseWorkerSlot(task.workerId);
    }
  }

  async reportWorkerFailure(
    task: Task,
    params: {
      message: string;
      providerCommentUrl?: string;
      gitStatus?: TaskResult['gitStatus'];
      durationMs?: number;
      stopReason?: TaskAbortReason;
    }
  ): Promise<void> {
    try {
      if (params.stopReason === 'manual_stop') {
        await this.finalizeWithRetry(task.id, 'failed', {
          message: TASK_MANUAL_STOP_MESSAGE,
          providerCommentUrl: params.providerCommentUrl,
          gitStatus: params.gitStatus
        });
        void this.logWriter.logExecution({
          level: 'warn',
          message: TASK_MANUAL_STOP_MESSAGE,
          code: 'TASK_STOPPED',
          repoId: task.repoId,
          taskId: task.id,
          taskGroupId: task.groupId,
          meta: { durationMs: params.durationMs ?? 0, retries: task.retries, workerId: task.workerId }
        });
        void this.emitTaskNotification(task, {
          type: 'TASK_STOPPED',
          level: 'warn',
          message: `Task stopped: ${buildTaskLabel(task)}`,
          code: 'TASK_STOPPED',
          externalUrl: params.providerCommentUrl,
          meta: { durationMs: params.durationMs ?? 0, retries: task.retries, workerId: task.workerId }
        });
        await this.runHookFinish(task, {
          status: 'failed',
          message: TASK_MANUAL_STOP_MESSAGE,
          providerCommentUrl: params.providerCommentUrl,
          durationMs: params.durationMs
        });
        return;
      }

      if (params.stopReason === 'deleted') {
        void this.logWriter.logExecution({
          level: 'error',
          message: 'Task deleted during execution.',
          code: 'TASK_DELETED',
          repoId: task.repoId,
          taskId: task.id,
          taskGroupId: task.groupId,
          meta: { durationMs: params.durationMs ?? 0, retries: task.retries, workerId: task.workerId }
        });
        void this.emitTaskNotification(task, {
          type: 'TASK_DELETED',
          level: 'error',
          message: `Task deleted: ${buildTaskLabel(task)}`,
          code: 'TASK_DELETED',
          externalUrl: params.providerCommentUrl,
          meta: { durationMs: params.durationMs ?? 0, retries: task.retries, workerId: task.workerId }
        });
        await this.runHookFinish(task, {
          status: 'failed',
          message: 'Task deleted during execution.',
          providerCommentUrl: params.providerCommentUrl,
          durationMs: params.durationMs
        });
        return;
      }

      await this.finalizeWithRetry(task.id, 'failed', {
        message: params.message,
        providerCommentUrl: params.providerCommentUrl,
        gitStatus: params.gitStatus
      });
      void this.logWriter.logExecution({
        level: 'error',
        message: params.message,
        code: 'TASK_FAILED',
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { durationMs: params.durationMs ?? 0, retries: task.retries, error: params.message, workerId: task.workerId }
      });
      void this.emitTaskNotification(task, {
        type: 'TASK_FAILED',
        level: 'error',
        message: `Task failed: ${buildTaskLabel(task)}`,
        code: 'TASK_FAILED',
        externalUrl: params.providerCommentUrl,
        meta: { durationMs: params.durationMs ?? 0, retries: task.retries, error: params.message, workerId: task.workerId }
      });
      await this.runHookFinish(task, {
        status: 'failed',
        message: params.message,
        providerCommentUrl: params.providerCommentUrl,
        durationMs: params.durationMs
      });
    } finally {
      if (task.workerId) await this.workersService.releaseWorkerSlot(task.workerId);
    }
  }

  async executeAssignedTaskInline(task: Task): Promise<void> {
    // Let the system-managed local worker fall back to backend-inline execution until every task ships a remote-safe command envelope. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    void this.logWriter.logSystem({
      level: 'info',
      message: 'Local worker delegated task back to backend inline executor',
      code: 'WORKER_LOCAL_INLINE_FALLBACK',
      meta: { taskId: task.id, taskGroupId: task.groupId, workerId: task.workerId }
    });

    try {
      await this.processTask(task);
    } finally {
      if (task.workerId) await this.workersService.releaseWorkerSlot(task.workerId);
    }
  }

  private async processTask(task: Task): Promise<void> {
    const startedAt = Date.now();
    await this.runHookStart(task);
    // Emit an execution log for task start to keep admin logs complete. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    void this.logWriter.logExecution({
      level: 'info',
      message: 'Task started',
      code: 'TASK_STARTED',
      repoId: task.repoId,
      taskId: task.id,
      taskGroupId: task.groupId,
      meta: { eventType: task.eventType, robotId: task.robotId, retries: task.retries }
    });

    let abortReason: TaskAbortReason | null = null;
    const abortController = new AbortController();
    let runtimeLimitTimer: NodeJS.Timeout | null = null;
    const requestAbort = (reason: TaskAbortReason) => {
      if (abortController.signal.aborted) return;
      abortReason = reason;
      // Abort in-flight providers so pause/delete requests stop execution quickly. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      abortController.abort(new Error(`task_${reason}`));
    };
    const stopControlPolling = this.startControlPolling(task.id, requestAbort);

    try {
      try {
        // Reset task_logs rows so retries start with a clean log stream. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
        await this.taskLogsService.clearLogs(task.id);
        await this.taskService.patchResult(task.id, {
          outputText: '',
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        });
      } catch (err) {
        console.warn('[taskRunner] pre-run outputText reset failed', task.id, err);
      }

      const executionOverride = normalizeBudgetExecutionOverride(task.result?.costGovernance?.executionOverride);
      if (executionOverride?.maxRuntimeSeconds && executionOverride.maxRuntimeSeconds > 0) {
        runtimeLimitTimer = setTimeout(() => requestAbort('runtime_limit'), executionOverride.maxRuntimeSeconds * 1000);
      }

      // Persist git status alongside logs/output so the UI can display change tracking. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const { providerCommentUrl, outputText, gitStatus, providerRouting } = await this.agentService.callAgent(task, {
        signal: abortController.signal
      });
      // Finalize without embedding log arrays because logs are stored in task_logs. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      await this.finalizeWithRetry(task.id, 'succeeded', { providerCommentUrl, outputText, gitStatus, providerRouting });
      // Record successful task completion in the audit log. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logExecution({
        level: 'info',
        message: 'Task succeeded',
        code: 'TASK_SUCCEEDED',
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { durationMs: Date.now() - startedAt, retries: task.retries }
      });
      // Notify the triggering user (or repo owner) about successful execution. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      void this.emitTaskNotification(task, {
        type: 'TASK_SUCCEEDED',
        level: 'info',
        message: `Task succeeded: ${buildTaskLabel(task)}`,
        code: 'TASK_SUCCEEDED',
        externalUrl: providerCommentUrl,
        meta: { durationMs: Date.now() - startedAt, retries: task.retries }
      });
      await this.runHookFinish(task, {
        status: 'succeeded',
        providerCommentUrl,
        durationMs: Date.now() - startedAt
      });
    } catch (err) {
      const providerCommentUrl = err instanceof AgentExecutionError ? err.providerCommentUrl : undefined;
      // Preserve git status on failed runs so the UI can show unpushed changes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const gitStatus = err instanceof AgentExecutionError ? err.gitStatus : undefined;
      const providerRouting = err instanceof AgentExecutionError ? err.providerRouting : undefined;
      const message = getErrorMessage(err);

      if (!abortReason && err instanceof AgentExecutionError && err.aborted) {
        // Treat provider aborts as manual-stop requests when no explicit reason is tracked. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
        abortReason = 'manual_stop';
      }

      const resolvedAbortReason = String(abortReason ?? '') as TaskAbortReason | '';

      if (resolvedAbortReason === 'runtime_limit') {
        await this.finalizeWithRetry(task.id, 'failed', {
          message: TASK_RUNTIME_LIMIT_MESSAGE,
          providerCommentUrl,
          gitStatus,
          providerRouting
        });
        void this.logWriter.logExecution({
          level: 'warn',
          message: TASK_RUNTIME_LIMIT_MESSAGE,
          code: 'TASK_RUNTIME_LIMIT',
          repoId: task.repoId,
          taskId: task.id,
          taskGroupId: task.groupId,
          meta: { durationMs: Date.now() - startedAt, retries: task.retries }
        });
        void this.emitTaskNotification(task, {
          type: 'TASK_FAILED',
          level: 'warn',
          message: `Task failed: ${buildTaskLabel(task)}`,
          code: 'TASK_RUNTIME_LIMIT',
          externalUrl: providerCommentUrl,
          meta: { durationMs: Date.now() - startedAt, retries: task.retries }
        });
        await this.runHookFinish(task, {
          status: 'failed',
          message: TASK_RUNTIME_LIMIT_MESSAGE,
          providerCommentUrl,
          durationMs: Date.now() - startedAt
        });
        return;
      }

      if (resolvedAbortReason === 'manual_stop') {
        // Finalize manual stops as failures so the queue has no resumable paused branch. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
        await this.finalizeWithRetry(task.id, 'failed', {
          message: TASK_MANUAL_STOP_MESSAGE,
          providerCommentUrl,
          gitStatus,
          providerRouting
        });
        // Persist manual-stop events for audit visibility. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
        void this.logWriter.logExecution({
          level: 'warn',
          message: TASK_MANUAL_STOP_MESSAGE,
          code: 'TASK_STOPPED',
          repoId: task.repoId,
          taskId: task.id,
          taskGroupId: task.groupId,
          meta: { durationMs: Date.now() - startedAt, retries: task.retries }
        });
        // Notify the triggering user (or repo owner) about manually stopped execution. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
        void this.emitTaskNotification(task, {
          type: 'TASK_STOPPED',
          level: 'warn',
          message: `Task stopped: ${buildTaskLabel(task)}`,
          code: 'TASK_STOPPED',
          externalUrl: providerCommentUrl,
          meta: { durationMs: Date.now() - startedAt, retries: task.retries }
        });
        await this.runHookFinish(task, {
          status: 'failed',
          message: TASK_MANUAL_STOP_MESSAGE,
          providerCommentUrl,
          durationMs: Date.now() - startedAt
        });
        return;
      }

      if (resolvedAbortReason === 'deleted') {
        console.warn('[taskRunner] task removed during execution; skip finalize', task.id);
        // Capture delete interruptions as error-level execution logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
        void this.logWriter.logExecution({
          level: 'error',
          message: 'Task deleted during execution.',
          code: 'TASK_DELETED',
          repoId: task.repoId,
          taskId: task.id,
          taskGroupId: task.groupId,
          meta: { durationMs: Date.now() - startedAt, retries: task.retries }
        });
        // Notify the triggering user (or repo owner) about deleted execution. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
        void this.emitTaskNotification(task, {
          type: 'TASK_DELETED',
          level: 'error',
          message: `Task deleted: ${buildTaskLabel(task)}`,
          code: 'TASK_DELETED',
          externalUrl: providerCommentUrl,
          meta: { durationMs: Date.now() - startedAt, retries: task.retries }
        });
        await this.runHookFinish(task, {
          status: 'failed',
          message: 'Task deleted during execution.',
          providerCommentUrl,
          durationMs: Date.now() - startedAt
        });
        return;
      }

      console.error('[taskRunner] task failed', task.id, err);
      // Persist failure metadata without duplicating log payloads in result_json. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      await this.finalizeWithRetry(task.id, 'failed', { message, providerCommentUrl, gitStatus, providerRouting });
      // Capture failures in the execution log stream for debugging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logExecution({
        level: 'error',
        message,
        code: 'TASK_FAILED',
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { durationMs: Date.now() - startedAt, retries: task.retries }
      });
      // Notify the triggering user (or repo owner) about failed execution. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      void this.emitTaskNotification(task, {
        type: 'TASK_FAILED',
        level: 'error',
        message: `Task failed: ${buildTaskLabel(task)}`,
        code: 'TASK_FAILED',
        externalUrl: providerCommentUrl,
        meta: { durationMs: Date.now() - startedAt, retries: task.retries, error: message }
      });
      await this.runHookFinish(task, {
        status: 'failed',
        message,
        providerCommentUrl,
        durationMs: Date.now() - startedAt
      });
    } finally {
      if (runtimeLimitTimer) clearTimeout(runtimeLimitTimer);
      stopControlPolling();
    }
  }

  private async emitTaskNotification(
    task: Task,
    params: {
      type: 'TASK_SUCCEEDED' | 'TASK_FAILED' | 'TASK_STOPPED' | 'TASK_DELETED';
      level: 'info' | 'warn' | 'error';
      message: string;
      code: string;
      externalUrl?: string; // Carry optional provider-side URLs into the notification link helper without splitting the public notification schema. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
      meta?: Record<string, unknown>;
    }
  ): Promise<void> {
    // Best-effort: emit user notifications without blocking task completion. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    try {
      const recipients = await this.notificationRecipients.resolveRecipientsForTask({
        repoId: task.repoId,
        actorUserId: task.actorUserId,
        payload: task.payload
      });
      const uniqueRecipients = Array.from(new Set(recipients.filter(Boolean)));
      if (!uniqueRecipients.length) return;

      await Promise.all(
        uniqueRecipients.map((userId) =>
          this.notificationsService.createNotification({
            userId,
            type: params.type,
            level: params.level,
            message: params.message,
            code: params.code,
            repoId: task.repoId,
            taskId: task.id,
            taskGroupId: task.groupId,
            linkUrl: buildNotificationLinkUrl({ taskId: task.id, externalUrl: params.externalUrl }), // Prefer task detail hashes while preserving external URLs only when no in-app target exists. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
            meta: params.meta
          })
        )
      );
    } catch (err) {
      console.warn('[taskRunner] notification emit failed', task.id, err);
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
