import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { db } from '../../db';
import {
  Task,
  TaskEventType,
  type TaskQueueDiagnosis,
  type TaskQueueReasonCode,
  TaskRepoSummary,
  TaskResult,
  TaskRobotSummary,
  TaskStatus,
  TaskWithMeta
} from '../../types/task';
import type { TaskGroup, TaskGroupWithMeta } from '../../types/taskGroup';
import type { RepoProvider } from '../../types/repository';
import { isTruthy, parseOptionalDurationMs } from '../../utils/env';
import { extractTaskSchedule, isTimeWindowActive } from '../../utils/timeWindow';
import type { TaskScheduleSnapshot } from '../../types/timeWindow';
import { isUuidLike } from '../../utils/uuid'; // Share UUID validation across pagination and list filters. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
import { EventStreamService } from '../events/event-stream.service';
import { LogWriterService } from '../logs/log-writer.service';
import { WorkersService } from '../workers/workers.service';
import { NotificationRecipientService } from '../notifications/notification-recipient.service';
import { ApprovalQueueService } from '../../policyEngine/approvalQueue.service';
import { PolicyEngineService } from '../../policyEngine/policyEngine.service';
import { QuotaEnforcerService } from '../../costGovernance/quotaEnforcer.service';
import { UsageAggregationService } from '../../costGovernance/usageAggregation.service';
import { BudgetService } from '../../costGovernance/budget.service';
import {
  TASK_MANUAL_STOP_MESSAGE,
  TASK_MANUAL_STOP_REASON,
  type TaskReorderAction
} from './task-control.constants';

/**
 * tasks table access layer (the "source of truth" for the queue/task state machine):
 * - Enqueue: `backend/src/routes/webhook.ts` calls `createTask()` to persist a Webhook event as queued.
 * - Consume: `backend/src/modules/tasks/task-runner.service.ts` uses `takeNextQueued()` to claim tasks while enforcing per-group exclusivity. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
 * - Display: `backend/src/routes/tasks.ts` uses `listTasks()` / `getTask()` to serve the frontend console.
 * - Logs: `backend/src/agent/agent.ts` writes execution logs into `task_logs` for paged/SSE log access. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
 */
export interface TaskCreateMeta {
  title?: string;
  projectId?: number;
  repoProvider?: RepoProvider;
  repoId?: string;
  robotId?: string;
  // Allow callers to request a specific worker when creating chat/manual tasks. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId?: string;
  // Persist the triggering user for notification routing. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  actorUserId?: string;
  ref?: string;
  mrId?: number;
  issueId?: number;
  promptCustom?: string | null;
}

export interface TaskCreateInGroupOptions {
  /**
   * Whether to update the TaskGroup's `robotId` when creating a task in an existing group.
   *
   * Business context:
   * - For `chat` groups, we treat `task_groups.robot_id` as "last used robot" to make the console list more useful.
   * - For issue/MR/commit groups, the bindingKey includes robotId; updating group.robotId can make the UI confusing,
   *   so callers should keep it `false` unless they explicitly want that behavior.
   *
   * Change record:
   * - 2026-01-10: Introduced for the new `/chat` manual trigger endpoint.
   */
  updateGroupRobotId?: boolean;
}

export interface TaskListOptions {
  limit?: number;
  cursor?: { id: string; updatedAt: Date };
  repoId?: string;
  robotId?: string;
  status?: TaskStatus | 'success';
  eventType?: TaskEventType;
  /**
   * Archive filter:
   * - active (default): archivedAt IS NULL
   * - archived: archivedAt IS NOT NULL
   * - all: no archivedAt filter. qnp1mtxhzikhbi0xspbc
   */
  archived?: 'active' | 'archived' | 'all';
  /**
   * Access control: only allow listing tasks under these repositories.
   * - Only used by the console API layer (non-admin users).
   * - Passing an empty array means "no access to any repo", and returns an empty list.
   */
  allowedRepoIds?: string[];
  includeMeta?: boolean;
  /**
   * Toggle queue diagnosis hydration to avoid extra global queue queries when callers only need task summaries. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
   */
  includeQueue?: boolean;
}

export interface TaskStatsOptions {
  repoId?: string;
  robotId?: string;
  eventType?: TaskEventType;
  /**
   * Archive filter (default: active). qnp1mtxhzikhbi0xspbc
   */
  archived?: 'active' | 'archived' | 'all';
  /**
   * Access control: only allow aggregating tasks under these repositories.
   * - Only used by the console API layer (non-admin users).
   * - Passing an empty array means "no access to any repo", and returns all zero counts.
   */
  allowedRepoIds?: string[];
}

export interface TaskStatusStats {
  total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
}

// Add a daily volume aggregation shape used by the repo dashboard trend chart. dashtrendline20260119m9v2
export interface TaskVolumeByDayPoint {
  day: string;
  count: number;
}

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const resolveScheduleState = (
  payload: unknown,
  now: Date
): { schedule: TaskScheduleSnapshot | null; blocked: boolean } => {
  // Evaluate time-window scheduling and manual overrides for queued tasks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const schedule = extractTaskSchedule(payload);
  if (!schedule) return { schedule: null, blocked: false };
  if (schedule.override) return { schedule, blocked: false };
  return { schedule, blocked: !isTimeWindowActive(schedule.window, now) };
};

const isTaskGroupProcessingConflict = (err: unknown): boolean => {
  // Detect task-group processing conflicts so workers can skip busy groups without failing the queue. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
  const prismaErr = err instanceof PrismaClientKnownRequestError ? err : null;
  const code = prismaErr?.code ?? (typeof (err as any)?.code === 'string' ? (err as any).code : '');
  const meta = prismaErr?.meta ?? (err as any)?.meta;
  const message = String((meta as any)?.message ?? (err as any)?.message ?? '');

  if (code === 'P2002') {
    return String((meta as any)?.target ?? '').includes('tasks_group_processing_unique_idx');
  }

  if (code === 'P2010') {
    const dbCode = String((meta as any)?.code ?? '');
    if (dbCode !== '23505') return false;
    return message.includes('tasks_group_processing_unique_idx');
  }

  return false;
};

const taskRecordToTask = (row: any): Task => ({
  id: String(row.id),
  groupId: row.groupId ? String(row.groupId) : undefined,
  groupOrder: typeof row.groupOrder === 'number' ? row.groupOrder : Number.isFinite(Number(row.groupOrder)) ? Number(row.groupOrder) : undefined,
  eventType: row.eventType as TaskEventType,
  status: row.status as TaskStatus,
  // Archived tasks are excluded from the worker queue and default console lists. qnp1mtxhzikhbi0xspbc
  archivedAt: row.archivedAt ? toIso(row.archivedAt) : undefined,
  payload: row.payload ?? null,
  promptCustom: row.promptCustom ?? undefined,
  title: row.title ?? undefined,
  projectId: row.projectId ?? undefined,
  repoProvider: row.repoProvider ?? undefined,
  repoId: row.repoId ?? undefined,
  robotId: row.robotId ?? undefined,
  // Surface worker ownership from Prisma task rows for dispatch-aware APIs. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId: row.workerId ?? row.worker_id ?? undefined,
  // Map actor user id for notification recipients. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  actorUserId: row.actorUserId ?? row.actor_user_id ?? undefined,
  ref: row.ref ?? undefined,
  mrId: row.mrId ?? undefined,
  issueId: row.issueId ?? undefined,
  retries: typeof row.retries === 'number' ? row.retries : Number(row.retries ?? 0),
  result: row.result ?? undefined,
  // Map dependency install results from task rows into API output. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult: row.dependencyResult ?? row.dependency_result ?? undefined,
  workerLostAt: row.workerLostAt ?? row.worker_lost_at ? toIso(row.workerLostAt ?? row.worker_lost_at) : undefined,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

const rowToTaskFromSql = (row: any): Task => ({
  id: String(row.id),
  groupId: row.group_id ? String(row.group_id) : undefined,
  groupOrder: typeof row.group_order === 'number' ? row.group_order : Number.isFinite(Number(row.group_order)) ? Number(row.group_order) : undefined,
  eventType: row.event_type as TaskEventType,
  status: row.status as TaskStatus,
  // Archived tasks are excluded from the worker queue and default console lists. qnp1mtxhzikhbi0xspbc
  archivedAt: row.archived_at ? toIso(row.archived_at) : undefined,
  payload: row.payload_json ?? null,
  promptCustom: row.prompt_custom ?? undefined,
  title: row.title ?? undefined,
  projectId: row.project_id ?? undefined,
  repoProvider: row.repo_provider ?? undefined,
  repoId: row.repo_id ?? undefined,
  robotId: row.robot_id ?? undefined,
  // Preserve worker ownership from raw SQL task rows so queue consumers know where to dispatch. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId: row.worker_id ?? undefined,
  // Preserve actor user id when loading tasks via raw SQL. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  actorUserId: row.actor_user_id ?? undefined,
  ref: row.ref ?? undefined,
  mrId: row.mr_id ?? undefined,
  issueId: row.issue_id ?? undefined,
  retries: typeof row.retries === 'number' ? row.retries : Number(row.retries ?? 0),
  result: row.result_json ?? undefined,
  // Preserve dependency install results when using raw SQL task queries. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult: row.dependency_result ?? row.dependencyResult ?? undefined,
  workerLostAt: row.worker_lost_at ? toIso(row.worker_lost_at) : undefined,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const taskGroupRecordToTaskGroup = (row: any): TaskGroup => ({
  id: String(row.id),
  kind: String(row.kind ?? 'task') as TaskGroup['kind'],
  bindingKey: String(row.bindingKey ?? row.binding_key ?? ''),
  threadId: row.threadId ?? row.thread_id ?? undefined,
  title: row.title ?? undefined,
  repoProvider: row.repoProvider ?? undefined,
  repoId: row.repoId ?? undefined,
  robotId: row.robotId ?? undefined,
  // Surface worker ownership from Prisma task rows for dispatch-aware APIs. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId: row.workerId ?? row.worker_id ?? undefined,
  issueId: row.issueId ?? undefined,
  mrId: row.mrId ?? undefined,
  commitSha: row.commitSha ?? undefined,
  skillSelections: Array.isArray(row.skillSelections ?? row.skill_selections) ? (row.skillSelections ?? row.skill_selections) : null,
  // Preserve per-task-group skill selection overrides for prompt injection. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  // Archived groups are excluded from default sidebar/chat lists. qnp1mtxhzikhbi0xspbc
  archivedAt: row.archivedAt ? toIso(row.archivedAt) : undefined,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

const isNotFoundError = (err: unknown): boolean =>
  err instanceof PrismaClientKnownRequestError && err.code === 'P2025';

const clampLimit = (value: unknown, fallback: number): number => {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback;
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.floor(num), 1), 200);
};

type TaskGroupBinding = {
  kind: 'issue' | 'merge_request' | 'commit' | 'task';
  bindingKey: string;
  issueId?: number;
  mrId?: number;
  commitSha?: string;
};

type TaskGroupEventReason = 'created' | 'status';

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Define the SSE event name for task-group timeline refresh pushes. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
const TASK_GROUP_EVENT_NAME = 'task-group.refresh';

const toFiniteInt = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const num = Math.floor(value);
  return num;
};

const isGitlabZeroSha = (sha: string): boolean => sha.length >= 40 && /^0+$/.test(sha);

const normalizeCommitSha = (value: unknown): string | null => {
  const sha = safeTrim(value);
  if (!sha) return null;
  if (isGitlabZeroSha(sha)) return null;
  return sha;
};

const extractCommitShaFromPayload = (payload: unknown): string | null => {
  const p: any = payload ?? {};
  const candidates = [
    p?.comment?.commit_id,
    p?.comment?.sha,
    p?.commit?.id,
    p?.commit?.sha,
    p?.object_attributes?.commit_id,
    p?.object_attributes?.commit_sha,
    p?.object_attributes?.last_commit?.id,
    p?.object_attributes?.last_commit?.sha,
    p?.merge_request?.last_commit?.id,
    p?.merge_request?.last_commit?.sha,
    p?.head_commit?.id,
    p?.head_commit?.sha,
    p?.checkout_sha,
    p?.after,
    Array.isArray(p?.commits) && p.commits.length ? p.commits[p.commits.length - 1]?.id : undefined,
    Array.isArray(p?.commits) && p.commits.length ? p.commits[p.commits.length - 1]?.sha : undefined
  ];
  for (const candidate of candidates) {
    const sha = normalizeCommitSha(candidate);
    if (sha) return sha;
  }
  return null;
};

const resolveTaskGroupBinding = (params: {
  taskId: string;
  eventType: TaskEventType;
  payload: unknown;
  meta?: TaskCreateMeta;
}): TaskGroupBinding => {
  const repoId = safeTrim(params.meta?.repoId);
  const robotId = safeTrim(params.meta?.robotId);

  const issueId = toFiniteInt(params.meta?.issueId);
  const mrId = toFiniteInt(params.meta?.mrId);

  if (repoId && robotId) {
    if (typeof issueId === 'number') {
      return { kind: 'issue', issueId, bindingKey: `${repoId}:${robotId}:issue:${issueId}` };
    }
    if (typeof mrId === 'number') {
      return { kind: 'merge_request', mrId, bindingKey: `${repoId}:${robotId}:merge_request:${mrId}` };
    }
    const commitSha = extractCommitShaFromPayload(params.payload);
    if (commitSha) {
      return { kind: 'commit', commitSha, bindingKey: `${repoId}:${robotId}:commit:${commitSha}` };
    }
    return { kind: 'task', bindingKey: `${repoId}:${robotId}:task:${params.taskId}` };
  }

  return { kind: 'task', bindingKey: `task:${params.taskId}` };
};

const TASK_LIST_SELECT = {
  id: true,
  groupId: true,
  eventType: true,
  status: true,
  title: true,
  projectId: true,
  repoProvider: true,
  repoId: true,
  robotId: true,
  workerId: true,
  workerLostAt: true,
  ref: true,
  mrId: true,
  issueId: true,
  retries: true,
  createdAt: true,
  updatedAt: true
} as const;

@Injectable()
export class TaskService {
  // Wire SSE/log helpers for task-group push updates. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
  constructor(
    private readonly eventStream?: EventStreamService,
    private readonly logWriter?: LogWriterService,
    private readonly notificationRecipients?: NotificationRecipientService,
    private readonly workersService?: WorkersService,
    private readonly policyEngine?: PolicyEngineService,
    private readonly approvalQueue?: ApprovalQueueService,
    private readonly quotaEnforcer?: QuotaEnforcerService,
    private readonly usageAggregationService?: UsageAggregationService,
    private readonly budgetService?: BudgetService
  ) {}

  private runningTaskGroupLogState = { lastLogAt: 0, lastCount: -1 }; // Throttle running-task group audit logs to avoid sidebar poll spam. docs/en/developer/plans/taskgroup-running-dot-20260305/task_plan.md taskgroup-running-dot-20260305

  private buildTaskGroupTopic(groupId: string): string {
    return `task-group:${groupId}`;
  }

  // Emit per-user task-group SSE updates so chat timelines refresh without manual reloads. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
  private async emitTaskGroupUpdate(task: Task, reason: TaskGroupEventReason): Promise<void> {
    if (!this.eventStream || !this.notificationRecipients || !this.logWriter) return;
    const groupId = safeTrim(task.groupId);
    if (!groupId) return;

    try {
      const recipients = await this.notificationRecipients.resolveRecipientsForTask({
        repoId: task.repoId,
        actorUserId: task.actorUserId,
        payload: task.payload
      });
      const uniqueRecipients = Array.from(new Set((recipients ?? []).filter(Boolean)));
      if (!uniqueRecipients.length) return;

      const payload = {
        groupId,
        taskId: task.id,
        status: task.status,
        updatedAt: toIso(task.updatedAt),
        reason
      };

      this.eventStream.publish({
        topic: this.buildTaskGroupTopic(groupId),
        event: TASK_GROUP_EVENT_NAME,
        data: payload,
        userIds: uniqueRecipients
      });

      // Record task-group push activity for audit visibility. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
      void this.logWriter.logSystem({
        level: 'info',
        message: 'Task group update pushed',
        code: 'TASK_GROUP_UPDATE_PUSHED',
        actorUserId: task.actorUserId,
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: groupId,
        meta: { reason, recipients: uniqueRecipients.length }
      });
    } catch (err) {
      console.warn('[tasks] task-group update push failed', task.id, err);
    }
  }

  private async resolveOrCreateGroupId(params: {
    taskId: string;
    eventType: TaskEventType;
    payload: unknown;
    meta?: TaskCreateMeta;
  }): Promise<string | null> {
    const now = new Date();
    const binding = resolveTaskGroupBinding(params);
    try {
      const group = await db.taskGroup.upsert({
        where: { bindingKey: binding.bindingKey },
        update: { updatedAt: now },
        create: {
          id: randomUUID(),
          kind: binding.kind,
          bindingKey: binding.bindingKey,
          threadId: null,
          title: params.meta?.title ?? null,
          repoProvider: params.meta?.repoProvider ?? null,
          repoId: params.meta?.repoId ?? null,
          robotId: params.meta?.robotId ?? null,
          // Persist the initial worker binding when a task group is created so later tasks reuse the same executor. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
          workerId: params.meta?.workerId ?? null,
          issueId: binding.issueId ?? null,
          mrId: binding.mrId ?? null,
          commitSha: binding.commitSha ?? null,
          createdAt: now,
          updatedAt: now
        }
      });
      return String(group.id);
    } catch (err) {
      console.warn('[tasks] create task group failed (ignored)', { taskId: params.taskId, error: err });
      return null;
    }
  }

  private async resolveEffectiveWorkerId(params: { requestedWorkerId?: string | null; taskGroupId?: string | null; robotId?: string | null }): Promise<string | null> {
    if (!this.workersService) return safeTrim(params.requestedWorkerId) || null;
    return this.workersService.findEffectiveWorkerId(params);
  }

  private async assertWorkerReadyForNewTask(workerId: string | null): Promise<void> {
    const normalized = safeTrim(workerId);
    if (!this.workersService) return;
    // Fail fast when no default or explicit worker is available so disabled/bootstrap-misconfigured deployments never enqueue tasks onto a null worker id silently. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    if (!normalized) {
      const error = new Error('No ready worker is configured for this task');
      (error as Error & { code?: string }).code = 'WORKER_NOT_CONFIGURED';
      throw error;
    }
    const readiness = await this.workersService.requireWorkerReadyForNewTask(normalized);
    if (readiness.ok) return;
    const error = new Error(readiness.message);
    (error as Error & { code?: string }).code = readiness.code;
    throw error;
  }

  private async attachMeta(tasks: TaskWithMeta[]): Promise<TaskWithMeta[]> {
    type RepoMetaRow = { id: string; provider: string; name: string; enabled: boolean };
    type RobotMetaRow = { id: string; repoId: string; name: string; permission: string; enabled: boolean };

    const repoIds = Array.from(new Set(tasks.map((t) => t.repoId).filter(Boolean))) as string[];
    const robotIds = Array.from(new Set(tasks.map((t) => t.robotId).filter(Boolean))) as string[];

    const [repos, robots, withWorkers, approvalMap] = await Promise.all([
      repoIds.length
        ? db.repository.findMany({
            where: { id: { in: repoIds } },
            select: { id: true, provider: true, name: true, enabled: true }
          })
        : Promise.resolve<RepoMetaRow[]>([]),
      robotIds.length
        ? db.repoRobot.findMany({
            where: { id: { in: robotIds } },
            select: { id: true, repoId: true, name: true, permission: true, enabled: true }
          })
        : Promise.resolve<RobotMetaRow[]>([]),
      this.workersService ? this.workersService.attachWorkerSummaries(tasks) : Promise.resolve(tasks),
      this.approvalQueue ? this.approvalQueue.getLatestApprovalsForTaskIds(tasks.map((task) => task.id)) : Promise.resolve(new Map())
    ] as const);

    const repoMap = new Map<string, TaskRepoSummary>(
      repos.map((r: RepoMetaRow): [string, TaskRepoSummary] => [
        String(r.id),
        {
          id: String(r.id),
          provider: String(r.provider) as RepoProvider,
          name: String(r.name),
          enabled: Boolean(r.enabled)
        }
      ])
    );
    const robotMap = new Map<string, TaskRobotSummary>(
      robots.map((r: RobotMetaRow): [string, TaskRobotSummary] => [
        String(r.id),
        {
          id: String(r.id),
          repoId: String(r.repoId),
          name: String(r.name),
          permission: String(r.permission) as TaskRobotSummary['permission'],
          enabled: Boolean(r.enabled)
        }
      ])
    );

    return withWorkers.map((task) => {
      const next: TaskWithMeta = { ...task };
      if (task.repoId && repoMap.has(task.repoId)) next.repo = repoMap.get(task.repoId);
      if (task.robotId && robotMap.has(task.robotId)) next.robot = robotMap.get(task.robotId);
      if (approvalMap.has(task.id)) next.approvalRequest = approvalMap.get(task.id);
      return next;
    });
  }

  private resolveQueueReasonCode(params: {
    ahead: number;
    processing: number;
  }): TaskQueueReasonCode {
    // Collapse legacy inline-worker hints into worker-availability/backlog hints for the external executor model. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    if (params.processing === 0) return 'no_active_worker';
    if (params.processing > 0 || params.ahead > 0) return 'queue_backlog';
    return 'unknown';
  }

  private async getNextGroupOrder(groupId?: string | null): Promise<number | undefined> {
    const id = safeTrim(groupId);
    if (!isUuidLike(id)) return undefined;
    // Persist explicit queue order so queued-task reordering does not depend on timestamps. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const row = await db.task.aggregate({
      where: { groupId: id, archivedAt: null },
      _max: { groupOrder: true }
    });
    const current = typeof row._max.groupOrder === 'number' ? row._max.groupOrder : 0;
    return current + 1;
  }

  private attachSequenceLinks<T extends TaskWithMeta>(tasks: T[]): T[] {
    // Derive previous/next task ids from explicit group order so the workspace can draw sequence connectors. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const ordered = [...tasks].sort((left, right) => {
      const orderDiff = (left.groupOrder ?? Number.MAX_SAFE_INTEGER) - (right.groupOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDiff !== 0) return orderDiff;
      const createdDiff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (createdDiff !== 0) return createdDiff;
      return left.id.localeCompare(right.id);
    });

    return ordered.map((task, index) => ({
      ...task,
      sequence: {
        order: index + 1,
        previousTaskId: ordered[index - 1]?.id,
        nextTaskId: ordered[index + 1]?.id
      }
    }));
  }

  private async rebalanceGroupTaskOrders(groupId: string, orderedTaskIds: string[]): Promise<void> {
    const normalizedGroupId = safeTrim(groupId);
    if (!isUuidLike(normalizedGroupId)) return;
    if (!orderedTaskIds.length) return;
    // Rewrite group order densely after each queue mutation so later reorders stay deterministic. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    await db.$transaction(
      orderedTaskIds.map((taskId, index) =>
        db.task.update({
          where: { id: taskId },
          data: { groupOrder: index + 1, updatedAt: new Date() }
        })
      )
    );
  }

  private async attachQueueDiagnosis(tasks: TaskWithMeta[]): Promise<TaskWithMeta[]> {
    // Attach best-effort queue diagnosis fields for queued tasks in list/detail APIs. f3a9c2d8e1b7f4a0c6d1
    const queued = tasks.filter((t) => t.status === 'queued');
    if (!queued.length) return tasks;

    const queuedIds = queued.map((t) => t.id);
    type QueuePosRow = { id: string; ahead: number; total: number };
    type ProcessingCountsRow = { processing: number; stale_processing: number };

    // Treat blank/zero PROCESSING_STALE_MS as disabled so queue stats avoid false stale counts. docs/en/developer/plans/stale-disable-20260305/task_plan.md stale-disable-20260305
    const staleMs = parseOptionalDurationMs(process.env.PROCESSING_STALE_MS, 30 * 60 * 1000);
    const staleBefore = staleMs === null ? new Date(0) : new Date(Date.now() - staleMs);

    const inlineWorkerEnabled = true;
    const now = new Date();

    const [posRows, processingRows] = await Promise.all([
      db.$queryRaw<QueuePosRow[]>`
        WITH q AS (
          SELECT id,
                 row_number() OVER (ORDER BY COALESCE(group_order, 2147483647) ASC, created_at ASC, id ASC) AS pos,
                 count(*) OVER () AS total
          FROM tasks
          WHERE status = 'queued'
            AND archived_at IS NULL
        )
        SELECT id::text AS id,
               (pos - 1)::int AS ahead,
               total::int AS total
        FROM q
        WHERE id = ANY(${queuedIds}::uuid[]);
      `,
      staleBefore
        ? db.$queryRaw<ProcessingCountsRow[]>`
            SELECT COUNT(*)::int AS processing,
                   COUNT(*) FILTER (WHERE updated_at < ${staleBefore})::int AS stale_processing
            FROM tasks
            WHERE status = 'processing';
          `
        : db.$queryRaw<ProcessingCountsRow[]>`
            -- Keep stale-processing metrics at zero when stale timeout is disabled by default. docs/en/developer/plans/worker-stuck-reasoning-20260304/task_plan.md worker-stuck-reasoning-20260304
            SELECT COUNT(*)::int AS processing,
                   0::int AS stale_processing
            FROM tasks
            WHERE status = 'processing';
          `
    ]);

    // Keep query-row callback typing explicit so preview-start compilation does not infer implicit any. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    const posMap = new Map<string, { ahead: number; total: number }>(
      (posRows ?? []).map((row: QueuePosRow) => [
        String(row.id),
        {
          ahead: Number(row.ahead ?? 0) || 0,
          total: Number(row.total ?? 0) || 0
        }
      ])
    );

    const processing = Number(processingRows?.[0]?.processing ?? 0) || 0;
    const staleProcessing = Number(processingRows?.[0]?.stale_processing ?? 0) || 0;

    return tasks.map((task) => {
      if (task.status !== 'queued') return task;
      const pos = posMap.get(task.id);
      const ahead = pos ? pos.ahead : 0;
      const queuedTotal = pos ? pos.total : queued.length;
      const scheduleState = resolveScheduleState(task.payload, now);
      const reasonCode = scheduleState.blocked
        ? 'outside_time_window'
        : this.resolveQueueReasonCode({ ahead, processing });
      const queue: TaskQueueDiagnosis = {
        reasonCode,
        ahead,
        queuedTotal,
        processing,
        staleProcessing,
        inlineWorkerEnabled,
        // Attach time window context when queued due to schedule. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        timeWindow: scheduleState.blocked && scheduleState.schedule
          ? {
              startHour: scheduleState.schedule.window.startHour,
              endHour: scheduleState.schedule.window.endHour,
              source: scheduleState.schedule.source,
              timezone: 'server'
            }
          : undefined
      };
      return { ...task, queue };
    });
  }

  private async applyPolicyGate(task: Task): Promise<Task> {
    if (!this.policyEngine) return task;
    const evaluation = await this.policyEngine.evaluateTask(task);

    if (evaluation.decision === 'require_approval' && this.approvalQueue) {
      await this.approvalQueue.enqueueApproval({
        taskId: task.id,
        repoId: task.repoId,
        robotId: task.robotId,
        actorUserId: task.actorUserId,
        evaluation
      });
      return (await this.getTask(task.id)) ?? { ...task, status: 'waiting_approval', result: { ...task.result, message: evaluation.summary } };
    }

    if (evaluation.decision === 'deny') {
      return (
        (await this.patchResult(
          task.id,
          {
            message: evaluation.summary,
            policyDecision: evaluation.decision,
            policyRiskLevel: evaluation.riskLevel
          },
          'failed'
        )) ?? { ...task, status: 'failed', result: { ...task.result, message: evaluation.summary } }
      );
    }

    if (evaluation.decision === 'allow_with_warning') {
      return (
        (await this.patchResult(task.id, {
          message: evaluation.summary,
          policyDecision: evaluation.decision,
          policyRiskLevel: evaluation.riskLevel
        })) ?? task
      );
    }

    return task;
  }

  private async applyCostGovernanceGate(task: Task): Promise<Task> {
    if (!this.quotaEnforcer) return task;
    const evaluation = await this.quotaEnforcer.evaluateTask(task);
    if (!evaluation) return task;

    const currentGovernance = isRecord(task.result) ? task.result.costGovernance : undefined;
    const unchanged = JSON.stringify(currentGovernance ?? null) === JSON.stringify(evaluation);
    const basePatch: Partial<TaskResult> = { costGovernance: evaluation };

    const recordQuotaEvent = async (eventType: 'warning' | 'blocked' | 'approval_required' | 'degrade_applied') => {
      if (!this.budgetService || unchanged) return;
      try {
        await this.budgetService.recordQuotaEvent({
          budgetPolicyId: evaluation.matchedPolicyId,
          taskId: task.id,
          repoId: task.repoId,
          robotId: task.robotId,
          actorUserId: task.actorUserId,
          scopeType: evaluation.matchedScopeType,
          scopeId: evaluation.matchedScopeId,
          eventType,
          decision: evaluation.decision,
          message: evaluation.summary || '',
          details: {
            exceeded: evaluation.exceeded,
            warnings: evaluation.warnings,
            executionOverride: evaluation.executionOverride
          }
        });
      } catch (err) {
        console.warn('[tasks] record quota event failed (ignored)', { taskId: task.id, error: err });
      }
    };

    if (evaluation.decision === 'deny') {
      await recordQuotaEvent('blocked');
      return (
        (await this.patchResult(
          task.id,
          {
            ...basePatch,
            message: evaluation.summary
          },
          'failed'
        )) ?? {
          ...task,
          status: 'failed',
          result: { ...task.result, ...basePatch, message: evaluation.summary }
        }
      );
    }

    if (evaluation.decision === 'require_approval' && this.approvalQueue) {
      await recordQuotaEvent('approval_required');
      await this.approvalQueue.enqueueApproval({
        taskId: task.id,
        repoId: task.repoId,
        robotId: task.robotId,
        actorUserId: task.actorUserId,
        evaluation: await this.quotaEnforcer.toApprovalEvaluation(task, evaluation)
      });
      return (
        (await this.getTask(task.id)) ?? {
          ...task,
          status: 'waiting_approval',
          result: { ...task.result, ...basePatch, message: evaluation.summary }
        }
      );
    }

    if (evaluation.decision === 'degrade') {
      await recordQuotaEvent('degrade_applied');
      return (
        (await this.patchResult(task.id, {
          ...basePatch,
          message: evaluation.summary
        })) ?? { ...task, result: { ...task.result, ...basePatch, message: evaluation.summary } }
      );
    }

    if (evaluation.decision === 'allow_with_warning') {
      await recordQuotaEvent('warning');
      return (
        (await this.patchResult(task.id, {
          ...basePatch,
          message: evaluation.summary
        })) ?? { ...task, result: { ...task.result, ...basePatch, message: evaluation.summary } }
      );
    }

    return (
      (await this.patchResult(task.id, basePatch)) ?? { ...task, result: { ...task.result, ...basePatch } }
    );
  }

  private async applyTaskGuards(task: Task): Promise<Task> {
    const costGoverned = await this.applyCostGovernanceGate(task);
    if (costGoverned.status !== 'queued') return costGoverned;
    return this.applyPolicyGate(costGoverned);
  }

  private async attachGroupMeta(groups: TaskGroupWithMeta[]): Promise<TaskGroupWithMeta[]> {
    type RepoMetaRow = { id: string; provider: string; name: string; enabled: boolean };
    type RobotMetaRow = { id: string; repoId: string; name: string; permission: string; enabled: boolean };

    const repoIds = Array.from(new Set(groups.map((g) => g.repoId).filter(Boolean))) as string[];
    const robotIds = Array.from(new Set(groups.map((g) => g.robotId).filter(Boolean))) as string[];
    const workerIds = Array.from(new Set(groups.map((g) => g.workerId).filter(Boolean))) as string[];

    const [repos, robots, workers] = await Promise.all([
      repoIds.length
        ? db.repository.findMany({
            where: { id: { in: repoIds } },
            select: { id: true, provider: true, name: true, enabled: true }
          })
        : Promise.resolve<RepoMetaRow[]>([]),
      robotIds.length
        ? db.repoRobot.findMany({
            where: { id: { in: robotIds } },
            select: { id: true, repoId: true, name: true, permission: true, enabled: true }
          })
        : Promise.resolve<RobotMetaRow[]>([]),
      workerIds.length ? db.worker.findMany({ where: { id: { in: workerIds } } }) : Promise.resolve<any[]>([])
    ] as const);

    const repoMap = new Map<string, TaskRepoSummary>(
      repos.map((r: RepoMetaRow): [string, TaskRepoSummary] => [
        String(r.id),
        {
          id: String(r.id),
          provider: String(r.provider) as RepoProvider,
          name: String(r.name),
          enabled: Boolean(r.enabled)
        }
      ])
    );
    const robotMap = new Map<string, TaskRobotSummary>(
      robots.map((r: RobotMetaRow): [string, TaskRobotSummary] => [
        String(r.id),
        {
          id: String(r.id),
          repoId: String(r.repoId),
          name: String(r.name),
          permission: String(r.permission) as TaskRobotSummary['permission'],
          enabled: Boolean(r.enabled)
        }
      ])
    );
    const workerMap = new Map(workers.map((worker) => [String(worker.id), { id: String(worker.id), name: String(worker.name), kind: String(worker.kind) as any, status: String(worker.status) as any, preview: Boolean((worker.capabilities as any)?.preview ?? false) }] as const));

    return groups.map((group) => {
      const next: TaskGroupWithMeta = { ...group };
      if (group.repoId && repoMap.has(group.repoId)) next.repo = repoMap.get(group.repoId);
      if (group.robotId && robotMap.has(group.robotId)) next.robot = robotMap.get(group.robotId);
      if (group.workerId && workerMap.has(group.workerId)) {
        next.workerSummary = workerMap.get(group.workerId);
        next.blockedByWorkerOffline = workerMap.get(group.workerId)?.status !== 'online';
      }
      return next;
    });
  }

  /**
   * Recover "stuck" processing tasks:
   * - Used for recovery after API/worker restarts or crashes (entry: `backend/src/worker.ts`).
   * - We only mark as failed and write a hint message; we do NOT auto-requeue to avoid accidentally triggering a large number of tasks.
   */
  async recoverStaleProcessing(staleMs: number | null): Promise<number> {
    // Skip stale recovery when PROCESSING_STALE_MS is unset so processing runtime is unlimited by default. docs/en/developer/plans/worker-stuck-reasoning-20260304/task_plan.md worker-stuck-reasoning-20260304
    if (typeof staleMs !== 'number' || !Number.isFinite(staleMs) || staleMs <= 0) return 0;
    const now = new Date();
    const threshold = new Date(now.getTime() - staleMs);
    // Change record (2026-01-15): stale processing warning message is now English to match UI expectations.
    const message = `Task has been in processing for ${Math.round(
      staleMs / 1000
    )}s without updates; it may have been interrupted by a restart/crash, so it was marked as failed. Please retry manually.`;

    const affected = await db.$executeRaw`
      UPDATE tasks
      SET status = 'failed',
          result_json = COALESCE(result_json, '{}'::jsonb) || jsonb_build_object('message', ${message}::text),
          updated_at = ${now}
      WHERE status = 'processing'
        AND updated_at < ${threshold}
    `;

    return Number(affected ?? 0);
  }

  async createTask(
    eventType: TaskEventType,
    payload: unknown,
    meta?: TaskCreateMeta
  ): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const preferredWorkerId = await this.resolveEffectiveWorkerId({
      requestedWorkerId: meta?.workerId ?? null,
      robotId: meta?.robotId ?? null
    });
    const groupId = await this.resolveOrCreateGroupId({
      taskId: id,
      eventType,
      payload,
      meta: { ...(meta ?? {}), workerId: preferredWorkerId ?? meta?.workerId }
    });
    const effectiveWorkerId = await this.resolveEffectiveWorkerId({
      requestedWorkerId: meta?.workerId ?? null,
      taskGroupId: groupId,
      robotId: meta?.robotId ?? null
    });
    await this.assertWorkerReadyForNewTask(effectiveWorkerId);
    const groupOrder = await this.getNextGroupOrder(groupId);
    const created = await db.task.create({
      data: {
        id,
        groupId,
        groupOrder,
        eventType,
        status: 'queued',
        payload: payload as any,
        promptCustom: meta?.promptCustom ?? null,
        title: meta?.title ?? null,
        projectId: meta?.projectId ?? null,
        repoProvider: meta?.repoProvider ?? null,
        repoId: meta?.repoId ?? null,
        robotId: meta?.robotId ?? null,
        workerId: effectiveWorkerId ?? null,
        // Capture triggering user for notification routing. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
        actorUserId: meta?.actorUserId ?? null,
        ref: meta?.ref ?? null,
        mrId: meta?.mrId ?? null,
        issueId: meta?.issueId ?? null,
        retries: 0,
        createdAt: now,
        updatedAt: now
      }
    });
    const task = await this.applyTaskGuards(taskRecordToTask(created));
    // Push task-group refresh events for new tasks. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
    void this.emitTaskGroupUpdate(task, 'created');
    return task;
  }

  /**
   * Create a new task under an existing TaskGroup (manual binding).
   *
   * Business context (Chat/manual trigger):
   * - Used by the `/chat` API and "run chat" UI embeds to append tasks to a chosen TaskGroup.
   * - Unlike webhook-triggered tasks, we must NOT derive group binding from (repoId, robotId, taskId); the caller
   *   explicitly chooses the group to continue the same "thread" across multiple executions.
   *
   * Key steps:
   * 1) Validate the group exists (and touch `updatedAt` so the group shows up as active).
   * 2) Create the queued task referencing the groupId.
   *
   * Pitfalls:
   * - TaskGroup bindingKey might have been created for a different robot (issue/MR groups are bound by robotId);
   *   this method intentionally allows creating tasks with a different `task.robotId` in the same group.
   */
  async createTaskInGroup(
    groupIdRaw: string,
    eventType: TaskEventType,
    payload: unknown,
    meta?: TaskCreateMeta,
    options?: TaskCreateInGroupOptions
  ): Promise<Task> {
    const groupId = safeTrim(groupIdRaw);
    if (!isUuidLike(groupId)) {
      throw new Error('invalid task group id');
    }

    const id = randomUUID();
    const now = new Date();
    const groupOrder = await this.getNextGroupOrder(groupId);

    // Touch the group so it stays active in the UI. Optionally update the displayed robotId (chat groups only).
    let effectiveWorkerId: string | null = null;
    try {
      const group = await db.taskGroup.update({
        where: { id: groupId },
        data: {
          updatedAt: now,
          ...(options?.updateGroupRobotId ? { robotId: meta?.robotId ?? null } : {})
        }
      });
      effectiveWorkerId = await this.resolveEffectiveWorkerId({
        requestedWorkerId: meta?.workerId ?? null,
        taskGroupId: String(group.id),
        robotId: meta?.robotId ?? null
      });
      await this.assertWorkerReadyForNewTask(effectiveWorkerId);
    } catch (err) {
      if (isNotFoundError(err)) throw new Error('task group not found');
      throw err;
    }

    const created = await db.task.create({
      data: {
        id,
        groupId,
        groupOrder,
        eventType,
        status: 'queued',
        payload: payload as any,
        promptCustom: meta?.promptCustom ?? null,
        title: meta?.title ?? null,
        projectId: meta?.projectId ?? null,
        repoProvider: meta?.repoProvider ?? null,
        repoId: meta?.repoId ?? null,
        robotId: meta?.robotId ?? null,
        workerId: effectiveWorkerId ?? null,
        // Capture triggering user for notification routing. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
        actorUserId: meta?.actorUserId ?? null,
        ref: meta?.ref ?? null,
        mrId: meta?.mrId ?? null,
        issueId: meta?.issueId ?? null,
        retries: 0,
        createdAt: now,
        updatedAt: now
      }
    });
    const task = await this.applyTaskGuards(taskRecordToTask(created));
    // Push task-group refresh events for group-bound tasks. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
    void this.emitTaskGroupUpdate(task, 'created');
    return task;
  }

  /**
   * Create a new "manual" TaskGroup.
   *
   * Business context:
   * - Webhook tasks create task groups implicitly via `bindingKey` (repoId+robotId+target).
   * - Console "Chat" needs an explicit group so multiple chat executions can share the same group/thread.
   *
   * Change record:
   * - 2026-01-10: Add `createManualTaskGroup()` for the new `/chat` API.
   */
  async createManualTaskGroup(params: {
    kind: TaskGroup['kind'];
    repoProvider?: RepoProvider;
    repoId?: string;
    robotId?: string;
    workerId?: string;
    title?: string;
  }): Promise<TaskGroup> {
    const now = new Date();
    const workerId = await this.resolveEffectiveWorkerId({ requestedWorkerId: params.workerId ?? null, robotId: params.robotId ?? null });
    await this.assertWorkerReadyForNewTask(workerId);

    // Retry on extremely unlikely bindingKey collisions (unique constraint).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = randomUUID();
      const bindingKey = `${params.kind}:${id}`;
      try {
        const row = await db.taskGroup.create({
          data: {
            id,
            kind: params.kind,
            bindingKey,
            threadId: null,
            title: params.title ?? null,
            repoProvider: params.repoProvider ?? null,
            repoId: params.repoId ?? null,
            robotId: params.robotId ?? null,
            workerId: workerId ?? null,
            issueId: null,
            mrId: null,
            commitSha: null,
            createdAt: now,
            updatedAt: now
          }
        });
        return taskGroupRecordToTaskGroup(row);
      } catch (err: any) {
        const isUniqueConflict =
          err instanceof PrismaClientKnownRequestError && err.code === 'P2002' && String(err?.meta?.target ?? '').includes('binding_key');
        if (isUniqueConflict) continue;
        throw err;
      }
    }

    throw new Error('failed to create task group');
  }

  async ensureTaskGroupId(task: Task): Promise<string | null> {
    const existing = typeof task.groupId === 'string' ? task.groupId.trim() : '';
    if (existing && isUuidLike(existing)) return existing;

    const groupId = await this.resolveOrCreateGroupId({
      taskId: task.id,
      eventType: task.eventType,
      payload: task.payload,
      meta: {
        title: task.title,
        projectId: task.projectId,
        repoProvider: task.repoProvider,
        repoId: task.repoId,
        robotId: task.robotId,
        ref: task.ref,
        mrId: task.mrId,
        issueId: task.issueId,
        promptCustom: task.promptCustom ?? null
      }
    });
    if (!groupId) return null;

    try {
      await db.task.update({
        where: { id: task.id },
        data: { groupId, updatedAt: new Date() }
      });
    } catch (err) {
      console.warn('[tasks] bind group to task failed (ignored)', { taskId: task.id, groupId, error: err });
    }

    return groupId;
  }

  async getTaskGroupThreadId(groupId: string): Promise<string | null> {
    const id = String(groupId ?? '').trim();
    if (!isUuidLike(id)) return null;
    const row = await db.taskGroup.findUnique({ where: { id }, select: { threadId: true } });
    const threadId = typeof row?.threadId === 'string' ? row.threadId.trim() : '';
    return threadId ? threadId : null;
  }

  async bindTaskGroupThreadId(groupId: string, threadId: string): Promise<boolean> {
    const id = String(groupId ?? '').trim();
    const normalizedThreadId = String(threadId ?? '').trim();
    if (!isUuidLike(id)) return false;
    if (!normalizedThreadId) return false;

    try {
      const updated = await db.taskGroup.updateMany({
        where: { id, threadId: null },
        data: { threadId: normalizedThreadId, updatedAt: new Date() }
      });
      return updated.count > 0;
    } catch (err) {
      console.warn('[tasks] bind task group threadId failed (ignored)', { groupId: id, error: err });
      return false;
    }
  }

  async listTaskGroups(options?: {
    limit?: number;
    cursor?: { id: string; updatedAt: Date };
    repoId?: string;
    robotId?: string;
    kind?: TaskGroup['kind'];
    archived?: 'active' | 'archived' | 'all';
    includeMeta?: boolean;
    allowedRepoIds?: string[];
  }): Promise<TaskGroupWithMeta[]> {
    const take = clampLimit(options?.limit, 50);
    const where: Record<string, any> = {};
    // Apply keyset pagination cursor to task list queries. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    const cursor = options?.cursor ?? null;
    if (options?.repoId) where.repoId = options.repoId;
    if (options?.robotId) where.robotId = options.robotId;
    if (options?.kind) where.kind = options.kind;
    // Exclude archived task groups from default sidebar/chat lists. qnp1mtxhzikhbi0xspbc
    const archiveScope = options?.archived ?? 'active';
    if (archiveScope === 'active') where.archivedAt = null;
    if (archiveScope === 'archived') where.archivedAt = { not: null };

    if (options?.repoId && !isUuidLike(options.repoId)) return [];
    if (options?.robotId && !isUuidLike(options.robotId)) return [];
    // Apply repo access filters for non-admin list views. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (options?.allowedRepoIds && !options.repoId) {
      if (options.allowedRepoIds.length === 0) return [];
      where.repoId = { in: options.allowedRepoIds };
    }
    if (cursor) {
      // Apply keyset pagination on updatedAt + id for stable task-group paging. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
      where.OR = [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }
      ];
    }

    const rows = await db.taskGroup.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take
    });

    const groups = rows.map(taskGroupRecordToTaskGroup) as TaskGroupWithMeta[];
    if (!options?.includeMeta) return groups;
    return this.attachGroupMeta(groups);
  }

  async listRunningTaskGroupIds(options: {
    groupIds: string[];
    repoId?: string;
    robotId?: string;
    allowedRepoIds?: string[];
    statuses?: TaskStatus[];
  }): Promise<Set<string>> {
    // Build running-task group ID set for sidebar indicators. docs/en/developer/plans/taskgroup-running-dot-20260305/task_plan.md taskgroup-running-dot-20260305
    const groupIds = (options.groupIds ?? []).map(safeTrim).filter(isUuidLike);
    if (!groupIds.length) return new Set();
    const repoId = safeTrim(options.repoId);
    const robotId = safeTrim(options.robotId);
    if (repoId && !isUuidLike(repoId)) return new Set();
    if (robotId && !isUuidLike(robotId)) return new Set();
    if (options.allowedRepoIds && !repoId) {
      if (options.allowedRepoIds.length === 0) return new Set();
    }

    const statuses = options.statuses?.length ? options.statuses : (['processing'] as TaskStatus[]);
    const where: Record<string, any> = {
      groupId: { in: groupIds },
      status: { in: statuses },
      archivedAt: null
    };
    if (repoId) where.repoId = repoId;
    if (robotId) where.robotId = robotId;
    if (options.allowedRepoIds && !repoId) {
      where.repoId = { in: options.allowedRepoIds };
    }

    const rows = await db.task.findMany({ where, select: { groupId: true }, distinct: ['groupId'] });
    const ids = new Set(rows.map((row) => safeTrim(row.groupId)).filter(isUuidLike));
    if (this.logWriter && ids.size > 0) {
      // Throttle audit logs so sidebar polling does not spam system logs. docs/en/developer/plans/taskgroup-running-dot-20260305/task_plan.md taskgroup-running-dot-20260305
      const now = Date.now();
      const shouldLog =
        now - this.runningTaskGroupLogState.lastLogAt > 5 * 60 * 1000 ||
        this.runningTaskGroupLogState.lastCount !== ids.size;
      if (shouldLog) {
        this.runningTaskGroupLogState = { lastLogAt: now, lastCount: ids.size };
        void this.logWriter.logSystem({
          level: 'info',
          message: 'Running task groups detected for sidebar indicators',
          code: 'TASK_GROUP_RUNNING_DETECTED',
          repoId: repoId || undefined,
          meta: {
            count: ids.size,
            statuses
          }
        });
      }
    }
    return ids;
  }

  async getTaskGroup(id: string, options?: { includeMeta?: boolean }): Promise<TaskGroupWithMeta | undefined> {
    const groupId = String(id ?? '').trim();
    if (!isUuidLike(groupId)) return undefined;

    const row = await db.taskGroup.findUnique({ where: { id: groupId } });
    const group = row ? (taskGroupRecordToTaskGroup(row) as TaskGroupWithMeta) : undefined;
    if (!group) return undefined;
    if (!options?.includeMeta) return group;
    const [withMeta] = await this.attachGroupMeta([group]);
    return withMeta;
  }

  async getTaskAccessSummary(id: string): Promise<{ id: string; repoId?: string; groupId?: string } | undefined> {
    // Fetch minimal task fields for log access checks without loading bulky result_json. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    const taskId = safeTrim(id);
    if (!isUuidLike(taskId)) return undefined;
    const row = await db.task.findUnique({
      where: { id: taskId },
      select: { id: true, repoId: true, groupId: true }
    });
    if (!row) return undefined;
    return {
      id: String(row.id),
      repoId: row.repoId ? String(row.repoId) : undefined,
      groupId: row.groupId ? String(row.groupId) : undefined
    };
  }

  async listTasksByGroup(
    groupId: string,
    options?: { limit?: number; includeMeta?: boolean; archived?: 'active' | 'archived' | 'all' }
  ): Promise<TaskWithMeta[]> {
    const id = String(groupId ?? '').trim();
    if (!isUuidLike(id)) return [];
    const take = clampLimit(options?.limit, 50);

    // Default to active-only tasks in group views so deleted/archived items do not linger. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    const archiveScope = options?.archived ?? 'active';
    const listAllArchived = archiveScope === 'all';
    const listArchivedOnly = archiveScope === 'archived';

    const rows = await db.$queryRaw<any[]>`
      SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
             group_order,
             jsonb_strip_nulls(jsonb_build_object(
               'message', NULLIF(result_json->>'message', ''),
               'summary', NULLIF(result_json->>'summary', ''),
               'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
               'tokenUsage', result_json->'tokenUsage',
               'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
               'providerRouting', result_json->'providerRouting',
               'gitStatus', result_json->'gitStatus'
             )) AS result_json
      FROM tasks
      WHERE group_id = ${id}::uuid
        AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
      ORDER BY COALESCE(group_order, 2147483647) ASC, created_at ASC, id ASC
      LIMIT ${take};
    `; // Strip logs from task-group lists to prevent loading full result_json payloads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    const tasks = rows.map(rowToTaskFromSql) as TaskWithMeta[];
    if (!options?.includeMeta) return tasks;
    const withMeta = await this.attachMeta(tasks);
    // Preserve queue diagnosis for task-group detail views. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    return this.attachSequenceLinks(await this.attachQueueDiagnosis(withMeta));
  }

  // Determine whether the task group already has another task so workers can reuse workspaces safely. docs/en/developer/plans/taskgroup-worker-env-20260203/task_plan.md taskgroup-worker-env-20260203
  async hasPriorTaskGroupTask(groupId: string, taskId: string): Promise<boolean> {
    const id = safeTrim(groupId);
    const currentId = safeTrim(taskId);
    if (!isUuidLike(id) || !isUuidLike(currentId)) return false;
    // Ignore archived tasks when deciding whether to resume threads/workspaces. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    const row = await db.task.findFirst({
      where: { groupId: id, NOT: { id: currentId }, archivedAt: null },
      select: { id: true }
    });
    return Boolean(row);
  }

  // Detect stored task-group logs so the worker can warn when starting in a fresh environment. docs/en/developer/plans/taskgroup-worker-env-20260203/task_plan.md taskgroup-worker-env-20260203
  async hasTaskGroupLogs(groupId: string): Promise<boolean> {
    const id = safeTrim(groupId);
    if (!isUuidLike(id)) return false;
    // Check task_logs for any entries tied to the task group. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    const row = await db.taskLog.findFirst({
      where: { task: { groupId: id } },
      select: { id: true }
    });
    return Boolean(row);
  }

  async listTasks(options?: TaskListOptions): Promise<TaskWithMeta[]> {
    // Change record (2026-01-12):
    // - Sort by `updated_at` (instead of `created_at`) so the console can surface the most recently updated tasks
    //   (status transitions, retries, log/result patches) at the top.
    const take = clampLimit(options?.limit, 50);
    const cursor = options?.cursor ?? null;
    const cursorUpdatedAt = cursor?.updatedAt ?? null;
    const cursorId = cursor?.id ?? null;
    const applyCursor = Boolean(cursorUpdatedAt && cursorId);
    const where: Record<string, any> = {};
    if (options?.repoId) where.repoId = options.repoId;
    if (options?.robotId) where.robotId = options.robotId;
    if (options?.eventType) where.eventType = options.eventType;
    if (options?.allowedRepoIds && !options.repoId) {
      where.repoId = { in: options.allowedRepoIds };
    }

    if (options?.repoId && !isUuidLike(options.repoId)) return [];
    if (options?.robotId && !isUuidLike(options.robotId)) return [];
    if (options?.allowedRepoIds && !options.repoId && options.allowedRepoIds.length === 0) return [];

    const repoId = options?.repoId ?? null;
    const robotId = options?.robotId ?? null;
    const eventType = options?.eventType ?? null;
    const allowedRepoIds = options?.allowedRepoIds ?? [];
    const restrictAllowedRepoIds = Boolean(options?.allowedRepoIds && !options.repoId);
    // Apply archive filtering consistently across the raw-SQL task list queries. qnp1mtxhzikhbi0xspbc
    const archiveScope = options?.archived ?? 'active';
    const listAllArchived = archiveScope === 'all';
    const listArchivedOnly = archiveScope === 'archived';

    let tasks: TaskWithMeta[] = [];
    if (!options?.status) {
      // Use updatedAt + id ordering to support stable keyset pagination across task lists. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
      const rows = await db.$queryRaw<any[]>`
        WITH candidates AS (
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'queued'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'waiting_approval'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'processing'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'succeeded'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'commented'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'failed'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
        )
        SELECT *
        FROM candidates
        ORDER BY updated_at DESC, id DESC
        LIMIT ${take};
      `;
      tasks = rows.map(rowToTaskFromSql) as TaskWithMeta[];
    } else if (options.status === 'success') {
      const rows = await db.$queryRaw<any[]>`
        WITH candidates AS (
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'succeeded'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                    'providerRouting', result_json->'providerRouting'
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
             AND status = 'commented'
           ORDER BY updated_at DESC, id DESC
           LIMIT ${take})
        )
        SELECT *
        FROM candidates
        ORDER BY updated_at DESC, id DESC
        LIMIT ${take};
      `;
      tasks = rows.map(rowToTaskFromSql) as TaskWithMeta[];
    } else {
      const status = options.status;
      const rows = await db.$queryRaw<any[]>`
        SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
               jsonb_strip_nulls(jsonb_build_object(
                 'message', NULLIF(result_json->>'message', ''),
                 'summary', NULLIF(result_json->>'summary', ''),
                 'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                 'tokenUsage', result_json->'tokenUsage',
                 'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', ''),
                 'providerRouting', result_json->'providerRouting'
               )) AS result_json
        FROM tasks
        WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
          AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
          AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
          AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
          AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
          AND (${applyCursor}::boolean = false OR updated_at < ${cursorUpdatedAt}::timestamptz OR (updated_at = ${cursorUpdatedAt}::timestamptz AND id < ${cursorId}::uuid))
          AND status = ${status}::text
        ORDER BY updated_at DESC, id DESC
        LIMIT ${take};
      `;
      tasks = rows.map(rowToTaskFromSql) as TaskWithMeta[];
    }

    if (!options?.includeMeta) return tasks;
    const withMeta = await this.attachMeta(tasks);
    const includeQueue = options?.includeQueue !== undefined ? options.includeQueue : true;
    if (!includeQueue) return withMeta;
    // Skip queue diagnosis when callers only need task summaries for dashboards. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    return this.attachQueueDiagnosis(withMeta);
  }

  async getTaskStats(options?: TaskStatsOptions): Promise<TaskStatusStats> {
    const where: Record<string, any> = {};
    if (options?.repoId) where.repoId = options.repoId;
    if (options?.robotId) where.robotId = options.robotId;
    if (options?.eventType) where.eventType = options.eventType;
    if (options?.allowedRepoIds && !options.repoId) {
      where.repoId = { in: options.allowedRepoIds };
    }
    // Keep stats in sync with the default "active only" task list behavior. qnp1mtxhzikhbi0xspbc
    const archiveScope = options?.archived ?? 'active';
    if (archiveScope === 'active') where.archivedAt = null;
    if (archiveScope === 'archived') where.archivedAt = { not: null };

    const rows = await db.task.groupBy({
      by: ['status'],
      where,
      _count: { _all: true }
    });

    const stats: TaskStatusStats = {
      total: 0,
      queued: 0,
      processing: 0,
      success: 0,
      failed: 0
    };

    for (const row of rows) {
      const count = Number((row as any)?._count?._all ?? 0);
      if (!count) continue;
      stats.total += count;

      const status = String((row as any)?.status ?? '');
      if (status === 'queued' || status === 'waiting_approval') stats.queued += count;
      else if (status === 'processing') stats.processing += count;
      else if (status === 'failed') stats.failed += count;
      else if (status === 'succeeded' || status === 'commented') stats.success += count;
    }

    return stats;
  }

  async getTaskVolumeByDay(options: {
    repoId: string;
    start: Date;
    endExclusive: Date;
    robotId?: string;
    eventType?: TaskEventType;
    allowedRepoIds?: string[];
    archived?: 'active' | 'archived' | 'all';
  }): Promise<TaskVolumeByDayPoint[]> {
    // Aggregate task volume per UTC day for the repo dashboard chart without loading full task lists. dashtrendline20260119m9v2
    const repoId = String(options?.repoId ?? '').trim();
    if (!repoId || !isUuidLike(repoId)) return [];

    const robotId = options?.robotId ? String(options.robotId).trim() : null;
    if (robotId && !isUuidLike(robotId)) return [];

    const eventType = options?.eventType ? String(options.eventType).trim() : null;
    // Exclude archived tasks from repo dashboard metrics by default (can be overridden via options). qnp1mtxhzikhbi0xspbc
    const archiveScope = options?.archived ?? 'active';
    const listAllArchived = archiveScope === 'all';
    const listArchivedOnly = archiveScope === 'archived';

    if (options?.allowedRepoIds) {
      if (options.allowedRepoIds.length === 0) return [];
      if (!options.allowedRepoIds.includes(repoId)) return [];
    }

    const start = options.start;
    const endExclusive = options.endExclusive;
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return [];
    if (!(endExclusive instanceof Date) || Number.isNaN(endExclusive.getTime())) return [];
    if (endExclusive.getTime() <= start.getTime()) return [];

    type DailyVolumeRow = { day: string; count: number };
    // Use a typed raw-query row shape so strict startup builds avoid implicit-any callback parameters. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    const rows = await db.$queryRaw<DailyVolumeRow[]>`
      SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM tasks
      WHERE repo_id = ${repoId}::uuid
        AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
        AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
        AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
        AND created_at >= ${start}
        AND created_at < ${endExclusive}
      GROUP BY 1
      ORDER BY 1 ASC;
    `;

    return rows.map((row: DailyVolumeRow) => ({
      day: String(row?.day ?? ''),
      count: Number(row?.count ?? 0) || 0
    }));
  }

  async getTask(id: string, options?: { includeMeta?: boolean }): Promise<TaskWithMeta | undefined> {
    const row = await db.task.findUnique({ where: { id } });
    const task = row ? (taskRecordToTask(row) as TaskWithMeta) : undefined;
    if (!task) return undefined;
    if (!options?.includeMeta) return task;
    const [withMeta] = await this.attachMeta([task]);
    const [withQueue] = await this.attachQueueDiagnosis([withMeta]);
    return withQueue;
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task | undefined> {
    const now = new Date();
    try {
      const row = await db.task.update({
        where: { id },
        data: { status, updatedAt: now }
      });
      return taskRecordToTask(row);
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  async updateResult(
    id: string,
    result: Partial<TaskResult>,
    status?: TaskStatus
  ): Promise<Task | undefined> {
    const now = new Date();
    const existing = await this.getTask(id);
    const mergedResult = { ...(existing?.result ?? {}), ...result };

    try {
      const row = await db.task.update({
        where: { id },
        data: {
          result: mergedResult as any,
          status: status ?? undefined,
          updatedAt: now
        }
      });
      return taskRecordToTask(row);
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  async updateDependencyResult(
    id: string,
    dependencyResult: Task['dependencyResult'] | null
  ): Promise<Task | undefined> {
    // Persist dependency install outcomes alongside task state for UI/diagnostics. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const now = new Date();
    try {
      const row = await db.task.update({
        where: { id },
        data: {
          dependencyResult: dependencyResult === null ? null : (dependencyResult as any),
          updatedAt: now
        }
      });
      return taskRecordToTask(row);
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  /**
   * Update result_json via JSON merge patch, and optionally update status.
   * - Does not need to read the previous result first (avoids read-before-write for high-frequency log updates).
   * - The patch is merged into existing result_json; overlapping keys are overwritten.
   */
  async patchResult(id: string, patch: Partial<TaskResult>, status?: TaskStatus): Promise<Task | undefined> {
    const now = new Date();
    const statusValue = status ?? null;
    const patchJson = JSON.stringify(patch ?? {});
    const rows = await db.$queryRaw<any[]>`
      UPDATE tasks
      SET result_json = COALESCE(result_json, '{}'::jsonb) || ${patchJson}::jsonb,
          status = COALESCE(${statusValue}::text, status),
          updated_at = ${now}
      WHERE id = ${id}
      RETURNING *;
    `;

    const task = rows?.[0] ? rowToTaskFromSql(rows[0]) : undefined;
    if (task && status && this.usageAggregationService) {
      if (status === 'succeeded' || status === 'failed' || status === 'commented') {
        try {
          await this.usageAggregationService.syncTaskRollups(task.id);
        } catch (err) {
          console.warn('[tasks] sync usage rollups failed (ignored)', { taskId: task.id, error: err });
        }
      }
    }
    if (task && status) {
      // Broadcast status-driven task-group updates to active chat sessions. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
      void this.emitTaskGroupUpdate(task, 'status');
    }
    return task;
  }

  async stripTaskResultLogs(id: string): Promise<void> {
    // Remove legacy log payloads from result_json after log-table migration/clears. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    const taskId = safeTrim(id);
    if (!isUuidLike(taskId)) return;
    await db.$queryRaw`
      UPDATE tasks
      SET result_json = CASE
        WHEN result_json IS NULL THEN NULL
        ELSE result_json - 'logs' - 'logsSeq'
      END
      WHERE id = ${taskId};
    `;
  }

  async retryTask(id: string): Promise<Task | undefined> {
    const now = new Date();
    try {
      const existing = await db.task.findUnique({ where: { id }, select: { groupId: true } });
      const groupOrder = await this.getNextGroupOrder(existing?.groupId ?? null);
      const rows = await db.$queryRaw<any[]>`
        UPDATE tasks
        SET status = 'queued',
            result_json = NULL,
            retries = retries + 1,
            updated_at = ${now},
            group_order = COALESCE(${groupOrder}::int, group_order)
        WHERE id = ${id}
        RETURNING *;
      `;
      if (rows?.[0] && this.usageAggregationService) {
        try {
          await this.usageAggregationService.clearTaskRollups(String(rows[0].id));
        } catch (err) {
          console.warn('[tasks] clear usage rollups failed (ignored)', { taskId: String(rows[0].id), error: err });
        }
      }
      const task = rows?.[0] ? await this.applyTaskGuards(rowToTaskFromSql(rows[0])) : undefined;
      if (!task) return undefined;
      // Notify chat clients about retry status changes. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
      void this.emitTaskGroupUpdate(task, 'status');
      return task;
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  async stopTask(id: string): Promise<Task | undefined> {
    const now = new Date();
    const taskId = safeTrim(id);
    if (!isUuidLike(taskId)) return undefined;
    try {
      const existing = await db.task.findUnique({ where: { id: taskId } });
      if (!existing) return undefined;
      if (existing.status === 'queued' || existing.status === 'waiting_approval') {
        const row = await db.task.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            result: {
              ...(typeof existing.result === 'object' && existing.result ? (existing.result as Record<string, unknown>) : {}),
              message: TASK_MANUAL_STOP_MESSAGE,
              stopReason: TASK_MANUAL_STOP_REASON
            } as any,
            updatedAt: now
          }
        });
        const task = taskRecordToTask(row);
        void this.emitTaskGroupUpdate(task, 'status');
        return task;
      }

      if (existing.status !== 'processing') return taskRecordToTask(existing);

      const patchJson = JSON.stringify({
        stopRequestedAt: now.toISOString(),
        stopReason: TASK_MANUAL_STOP_REASON,
        message: TASK_MANUAL_STOP_MESSAGE
      });
      const rows = await db.$queryRaw<any[]>`
        UPDATE tasks
        SET result_json = COALESCE(result_json, '{}'::jsonb) || ${patchJson}::jsonb,
            updated_at = ${now}
        WHERE id = ${taskId}
        RETURNING *;
      `;
      const task = rows?.[0] ? rowToTaskFromSql(rows[0]) : undefined;
      if (task) void this.emitTaskGroupUpdate(task, 'status');
      return task;
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  async updateQueuedTaskText(id: string, text: string): Promise<Task | undefined> {
    const taskId = safeTrim(id);
    const nextText = String(text ?? '').trim();
    if (!isUuidLike(taskId) || !nextText) return undefined;
    const existing = await db.task.findUnique({ where: { id: taskId } });
    if (!existing || existing.status !== 'queued') return undefined;

    const payload = (existing.payload ?? {}) as Record<string, any>;
    const nextPayload = {
      ...payload,
      __chat: { ...(payload.__chat ?? {}), text: nextText },
      object_attributes: payload.object_attributes ? { ...payload.object_attributes, note: nextText } : payload.object_attributes,
      comment: payload.comment ? { ...payload.comment, body: nextText } : payload.comment
    };
    const nextTitle = `Chat · ${nextText.replace(/\s+/g, ' ').trim().slice(0, 80)}`;
    // Update queued manual-task payloads in place so users can edit work before execution starts. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const row = await db.task.update({
      where: { id: taskId },
      data: {
        payload: nextPayload as any,
        title: nextTitle,
        updatedAt: new Date()
      }
    });
    const task = await this.applyTaskGuards(taskRecordToTask(row));
    void this.emitTaskGroupUpdate(task, 'status');
    return task;
  }

  async reorderQueuedTask(id: string, action: TaskReorderAction): Promise<Task | undefined> {
    const taskId = safeTrim(id);
    if (!isUuidLike(taskId)) return undefined;
    const existing = await db.task.findUnique({ where: { id: taskId }, select: { id: true, groupId: true, status: true, archivedAt: true } });
    if (!existing || existing.status !== 'queued' || existing.archivedAt) return undefined;
    const groupId = safeTrim(existing.groupId);
    if (!isUuidLike(groupId)) return undefined;

    const rows = await db.$queryRaw<any[]>`
      SELECT id, group_id, group_order, created_at, status
      FROM tasks
      WHERE group_id = ${groupId}::uuid
        AND archived_at IS NULL
      ORDER BY COALESCE(group_order, 2147483647) ASC, created_at ASC, id ASC;
    `;
    const ordered = rows.map((row) => ({
      id: String(row.id),
      status: String(row.status),
      groupOrder: typeof row.group_order === 'number' ? row.group_order : Number(row.group_order ?? 0) || 0,
      createdAt: toIso(row.created_at)
    }));
    const queueIds = ordered.filter((task) => task.status === 'queued').map((task) => task.id);
    const currentIndex = queueIds.findIndex((queuedId) => queuedId === taskId);
    if (currentIndex < 0) return undefined;

    const nextQueueIds = [...queueIds];
    if (action === 'move_earlier' && currentIndex > 0) {
      [nextQueueIds[currentIndex - 1], nextQueueIds[currentIndex]] = [nextQueueIds[currentIndex], nextQueueIds[currentIndex - 1]];
    } else if (action === 'move_later' && currentIndex < nextQueueIds.length - 1) {
      [nextQueueIds[currentIndex], nextQueueIds[currentIndex + 1]] = [nextQueueIds[currentIndex + 1], nextQueueIds[currentIndex]];
    } else if (action === 'insert_next') {
      nextQueueIds.splice(currentIndex, 1);
      nextQueueIds.unshift(taskId);
    }

    const terminalIds = ordered.filter((task) => task.status !== 'queued').map((task) => task.id);
    await this.rebalanceGroupTaskOrders(groupId, [...terminalIds, ...nextQueueIds]);

    const refreshed = await db.task.findUnique({ where: { id: taskId } });
    const task = refreshed ? taskRecordToTask(refreshed) : undefined;
    if (task) void this.emitTaskGroupUpdate(task, 'status');
    return task;
  }

  async getTaskControlState(id: string): Promise<{ status: TaskStatus; archivedAt?: string; stopRequested: boolean } | null> {
    const taskId = safeTrim(id);
    if (!isUuidLike(taskId)) return null;
    // Return minimal task control state for stop polling and worker abort checks. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const row = await db.task.findUnique({ where: { id: taskId }, select: { status: true, archivedAt: true, result: true } });
    if (!row) return null;
    const result = (row.result ?? {}) as Record<string, unknown>;
    return {
      status: row.status as TaskStatus,
      archivedAt: row.archivedAt ? toIso(row.archivedAt) : undefined,
      stopRequested: typeof result.stopRequestedAt === 'string' && result.stopRequestedAt.trim().length > 0
    };
  }

  async hasQueuedTaskForRule(params: { repoId: string; robotId: string; ruleId: string }): Promise<boolean> {
    // Guard against duplicate trigger-level tasks while waiting for a time window. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    const rows = await db.$queryRaw<any[]>`
      SELECT id
      FROM tasks
      WHERE status = 'queued'
        AND archived_at IS NULL
        AND repo_id = ${params.repoId}
        AND robot_id = ${params.robotId}
        AND payload_json -> '__schedule' ->> 'ruleId' = ${params.ruleId}
      LIMIT 1;
    `;
    return (rows?.length ?? 0) > 0;
  }

  async setTaskScheduleOverride(id: string, override: boolean): Promise<Task | undefined> {
    // Persist a manual override flag so queued tasks can run outside the configured window. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) return undefined;
    const payload = existing.payload ?? {};
    const schedule = extractTaskSchedule(payload);
    if (!schedule) return undefined;
    const nextPayload = {
      ...(payload as any),
      __schedule: {
        ...schedule,
        override,
        overrideAt: new Date().toISOString()
      }
    };
    const row = await db.task.update({
      where: { id },
      data: { payload: nextPayload as any, updatedAt: new Date() }
    });
    return taskRecordToTask(row);
  }

  async takeNextQueued(): Promise<Task | undefined> {
    const batchSize = 50;
    // Scan queued tasks in order and skip those blocked by time windows or busy groups; claim the first eligible row. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
    const candidates = await db.$queryRaw<any[]>`
      SELECT tasks.*
      FROM tasks
      INNER JOIN workers ON workers.id = tasks.worker_id
      WHERE tasks.status = 'queued'
        AND tasks.archived_at IS NULL
        AND workers.status = 'online'
        AND workers.disabled_at IS NULL
        AND COALESCE(workers.current_concurrency, 0) < COALESCE(workers.max_concurrency, 1)
      ORDER BY COALESCE(tasks.group_order, 2147483647) ASC, tasks.created_at ASC, tasks.id ASC
      LIMIT ${batchSize};
    `;

    if (!candidates?.length) return undefined;

    const now = new Date();
    for (const row of candidates) {
      const task = rowToTaskFromSql(row);
      const guardedTask = await this.applyTaskGuards(task);
      if (guardedTask.status !== 'queued') continue;
      const scheduleState = resolveScheduleState(guardedTask.payload, now);
      if (scheduleState.blocked) continue;

      try {
        const claimed = await db.$queryRaw<any[]>`
          UPDATE tasks
          SET status = 'processing', updated_at = ${now}
          WHERE id = ${task.id}
            AND status = 'queued'
            AND archived_at IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM tasks AS active
              WHERE active.status = 'processing'
                AND active.archived_at IS NULL
                AND active.group_id = tasks.group_id
            )
          RETURNING *;
        `;
        if (claimed?.[0]) {
          // Push the queued->processing transition immediately so new task-group workspaces do not stay visually stale after claim. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
          const claimedTask = rowToTaskFromSql(claimed[0]);
          void this.emitTaskGroupUpdate(claimedTask, 'status');
          return claimedTask;
        }
      } catch (err) {
        if (isTaskGroupProcessingConflict(err)) {
          continue;
        }
        throw err;
      }
    }

    return undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    const taskId = safeTrim(id);
    if (!isUuidLike(taskId)) return false;
    const existing = await db.task.findUnique({ where: { id: taskId }, select: { id: true, groupId: true } });
    if (!existing) return false;
    const result = await db.task.deleteMany({ where: { id: taskId } });
    if (result.count === 0) return false;

    const groupId = safeTrim(existing.groupId);
    if (groupId && isUuidLike(groupId)) {
      try {
        const remaining = await db.task.count({ where: { groupId } });
        if (remaining === 0) {
          // Clear stale task-group thread ids after deleting the last task. docs/en/developer/plans/taskgroup-resume-thread-20260203/task_plan.md taskgroup-resume-thread-20260203
          await db.taskGroup.updateMany({ where: { id: groupId }, data: { threadId: null, updatedAt: new Date() } });
        }
      } catch (err) {
        console.warn('[tasks] clear task group threadId failed (ignored)', { groupId, error: err });
      }
    }

    return true;
  }
}
