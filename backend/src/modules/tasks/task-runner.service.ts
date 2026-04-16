import { Injectable } from '@nestjs/common';
import { Task, type TaskResult, type TaskStatus } from '../../types/task';
import { TaskService } from './task.service';
import { TaskLogsService } from './task-logs.service';
import { LogWriterService } from '../logs/log-writer.service';
import { buildNotificationLinkUrl } from '../notifications/notification-links';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationRecipientService } from '../notifications/notification-recipient.service';
import { TASK_MANUAL_STOP_MESSAGE } from './task-control.constants';
import { WorkersService } from '../workers/workers.service';

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
 * Task lifecycle manager.
 * Workers pull tasks via the poll endpoint (WorkersInternalController).
 * reportWorkerSuccess / reportWorkerFailure are called by the internal controller on finalize.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type TaskAbortReason = 'manual_stop' | 'deleted' | 'runtime_limit';

const buildTaskLabel = (task: Task): string => {
  return task.title ? task.title : `Task ${task.id}`;
};

@Injectable()
export class TaskRunner {
  private hooks: TaskRunnerHooks | null = null;

  constructor(
    private readonly taskService: TaskService,
    private readonly taskLogsService: TaskLogsService,
    private readonly logWriter: LogWriterService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationRecipients: NotificationRecipientService,
    private readonly workersService: WorkersService
  ) {}

  setHooks(hooks: TaskRunnerHooks | null): void {
    this.hooks = hooks;
  }

  // ── Worker Finalization (called by WorkersInternalController) ──

  async reportWorkerSuccess(
    task: Task,
    params: { providerCommentUrl?: string; outputText?: string; gitStatus?: TaskResult['gitStatus']; durationMs?: number }
  ): Promise<void> {
    await this.finalizeWithRetry(task.id, 'succeeded', {
      providerCommentUrl: params.providerCommentUrl,
      outputText: params.outputText,
      gitStatus: params.gitStatus
    });
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
  }

  // ── Private ──

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

  private async emitTaskNotification(
    task: Task,
    params: {
      type: 'TASK_SUCCEEDED' | 'TASK_FAILED' | 'TASK_STOPPED' | 'TASK_DELETED';
      level: 'info' | 'warn' | 'error';
      message: string;
      code: string;
      externalUrl?: string;
      meta?: Record<string, unknown>;
    }
  ): Promise<void> {
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
            linkUrl: buildNotificationLinkUrl({ taskId: task.id, externalUrl: params.externalUrl }),
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
