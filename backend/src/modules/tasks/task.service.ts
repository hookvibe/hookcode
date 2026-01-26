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
import { isTruthy } from '../../utils/env';

/**
 * tasks table access layer (the "source of truth" for the queue/task state machine):
 * - Enqueue: `backend/src/routes/webhook.ts` calls `createTask()` to persist a Webhook event as queued.
 * - Consume: `backend/src/services/taskRunner.ts` uses `takeNextQueued()` with `FOR UPDATE SKIP LOCKED` to serially claim tasks and mark them processing.
 * - Display: `backend/src/routes/tasks.ts` uses `listTasks()` / `getTask()` to serve the frontend console.
 * - Logs: `backend/src/agent/agent.ts` writes execution logs into `result_json.logs` for console SSE/polling.
 */
export interface TaskCreateMeta {
  title?: string;
  projectId?: number;
  repoProvider?: RepoProvider;
  repoId?: string;
  robotId?: string;
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

const taskRecordToTask = (row: any): Task => ({
  id: String(row.id),
  groupId: row.groupId ? String(row.groupId) : undefined,
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
  ref: row.ref ?? undefined,
  mrId: row.mrId ?? undefined,
  issueId: row.issueId ?? undefined,
  retries: typeof row.retries === 'number' ? row.retries : Number(row.retries ?? 0),
  result: row.result ?? undefined,
  // Map dependency install results from task rows into API output. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult: row.dependencyResult ?? row.dependency_result ?? undefined,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

const rowToTaskFromSql = (row: any): Task => ({
  id: String(row.id),
  groupId: row.group_id ? String(row.group_id) : undefined,
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
  ref: row.ref ?? undefined,
  mrId: row.mr_id ?? undefined,
  issueId: row.issue_id ?? undefined,
  retries: typeof row.retries === 'number' ? row.retries : Number(row.retries ?? 0),
  result: row.result_json ?? undefined,
  // Preserve dependency install results when using raw SQL task queries. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult: row.dependency_result ?? row.dependencyResult ?? undefined,
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
  issueId: row.issueId ?? undefined,
  mrId: row.mrId ?? undefined,
  commitSha: row.commitSha ?? undefined,
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

const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type TaskGroupBinding = {
  kind: 'issue' | 'merge_request' | 'commit' | 'task';
  bindingKey: string;
  issueId?: number;
  mrId?: number;
  commitSha?: string;
};

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

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
  ref: true,
  mrId: true,
  issueId: true,
  retries: true,
  createdAt: true,
  updatedAt: true
} as const;

@Injectable()
export class TaskService {
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

  private async attachMeta(tasks: TaskWithMeta[]): Promise<TaskWithMeta[]> {
    type RepoMetaRow = { id: string; provider: string; name: string; enabled: boolean };
    type RobotMetaRow = { id: string; repoId: string; name: string; permission: string; enabled: boolean };

    const repoIds = Array.from(new Set(tasks.map((t) => t.repoId).filter(Boolean))) as string[];
    const robotIds = Array.from(new Set(tasks.map((t) => t.robotId).filter(Boolean))) as string[];

    const [repos, robots] = await Promise.all([
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
        : Promise.resolve<RobotMetaRow[]>([])
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

    return tasks.map((task) => {
      const next: TaskWithMeta = { ...task };
      if (task.repoId && repoMap.has(task.repoId)) next.repo = repoMap.get(task.repoId);
      if (task.robotId && robotMap.has(task.robotId)) next.robot = robotMap.get(task.robotId);
      return next;
    });
  }

  private resolveQueueReasonCode(params: {
    ahead: number;
    processing: number;
    inlineWorkerEnabled: boolean;
  }): TaskQueueReasonCode {
    // Pick a single primary reason code so the UI can render a concise queued hint. f3a9c2d8e1b7f4a0c6d1
    if (!params.inlineWorkerEnabled && params.processing === 0) return 'inline_worker_disabled';
    if (params.processing === 0) return 'no_active_worker';
    if (params.processing > 0 || params.ahead > 0) return 'queue_backlog';
    return 'unknown';
  }

  private async attachQueueDiagnosis(tasks: TaskWithMeta[]): Promise<TaskWithMeta[]> {
    // Attach best-effort queue diagnosis fields for queued tasks in list/detail APIs. f3a9c2d8e1b7f4a0c6d1
    const queued = tasks.filter((t) => t.status === 'queued');
    if (!queued.length) return tasks;

    const queuedIds = queued.map((t) => t.id);
    type QueuePosRow = { id: string; ahead: number; total: number };
    type ProcessingCountsRow = { processing: number; stale_processing: number };

    const staleMs = Number(process.env.PROCESSING_STALE_MS || 30 * 60 * 1000);
    const staleBefore = new Date(Date.now() - (Number.isFinite(staleMs) && staleMs > 0 ? staleMs : 30 * 60 * 1000));

    const inlineWorkerEnabled = isTruthy(process.env.INLINE_WORKER_ENABLED, true);

    const [posRows, processingRows] = await Promise.all([
      db.$queryRaw<QueuePosRow[]>`
        WITH q AS (
          SELECT id,
                 row_number() OVER (ORDER BY created_at ASC) AS pos,
                 count(*) OVER () AS total
          FROM tasks
          WHERE status = 'queued'
        )
        SELECT id::text AS id,
               (pos - 1)::int AS ahead,
               total::int AS total
        FROM q
        WHERE id = ANY(${queuedIds}::uuid[]);
      `,
      db.$queryRaw<ProcessingCountsRow[]>`
        SELECT COUNT(*)::int AS processing,
               COUNT(*) FILTER (WHERE updated_at < ${staleBefore})::int AS stale_processing
        FROM tasks
        WHERE status = 'processing';
      `
    ]);

    const posMap = new Map<string, { ahead: number; total: number }>(
      (posRows ?? []).map((row) => [
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
      const reasonCode = this.resolveQueueReasonCode({ ahead, processing, inlineWorkerEnabled });
      const queue: TaskQueueDiagnosis = {
        reasonCode,
        ahead,
        queuedTotal,
        processing,
        staleProcessing,
        inlineWorkerEnabled
      };
      return { ...task, queue };
    });
  }

  private async attachGroupMeta(groups: TaskGroupWithMeta[]): Promise<TaskGroupWithMeta[]> {
    type RepoMetaRow = { id: string; provider: string; name: string; enabled: boolean };
    type RobotMetaRow = { id: string; repoId: string; name: string; permission: string; enabled: boolean };

    const repoIds = Array.from(new Set(groups.map((g) => g.repoId).filter(Boolean))) as string[];
    const robotIds = Array.from(new Set(groups.map((g) => g.robotId).filter(Boolean))) as string[];

    const [repos, robots] = await Promise.all([
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
        : Promise.resolve<RobotMetaRow[]>([])
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

    return groups.map((group) => {
      const next: TaskGroupWithMeta = { ...group };
      if (group.repoId && repoMap.has(group.repoId)) next.repo = repoMap.get(group.repoId);
      if (group.robotId && robotMap.has(group.robotId)) next.robot = robotMap.get(group.robotId);
      return next;
    });
  }

  /**
   * Recover "stuck" processing tasks:
   * - Used for recovery after API/worker restarts or crashes (entry: `backend/src/worker.ts`).
   * - We only mark as failed and write a hint message; we do NOT auto-requeue to avoid accidentally triggering a large number of tasks.
   */
  async recoverStaleProcessing(staleMs: number): Promise<number> {
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
    const groupId = await this.resolveOrCreateGroupId({ taskId: id, eventType, payload, meta });
    const created = await db.task.create({
      data: {
        id,
        groupId,
        eventType,
        status: 'queued',
        payload: payload as any,
        promptCustom: meta?.promptCustom ?? null,
        title: meta?.title ?? null,
        projectId: meta?.projectId ?? null,
        repoProvider: meta?.repoProvider ?? null,
        repoId: meta?.repoId ?? null,
        robotId: meta?.robotId ?? null,
        ref: meta?.ref ?? null,
        mrId: meta?.mrId ?? null,
        issueId: meta?.issueId ?? null,
        retries: 0,
        createdAt: now,
        updatedAt: now
      }
    });
    return taskRecordToTask(created);
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

    // Touch the group so it stays active in the UI. Optionally update the displayed robotId (chat groups only).
    try {
      await db.taskGroup.update({
        where: { id: groupId },
        data: {
          updatedAt: now,
          ...(options?.updateGroupRobotId ? { robotId: meta?.robotId ?? null } : {})
        }
      });
    } catch (err) {
      if (isNotFoundError(err)) throw new Error('task group not found');
      throw err;
    }

    const created = await db.task.create({
      data: {
        id,
        groupId,
        eventType,
        status: 'queued',
        payload: payload as any,
        promptCustom: meta?.promptCustom ?? null,
        title: meta?.title ?? null,
        projectId: meta?.projectId ?? null,
        repoProvider: meta?.repoProvider ?? null,
        repoId: meta?.repoId ?? null,
        robotId: meta?.robotId ?? null,
        ref: meta?.ref ?? null,
        mrId: meta?.mrId ?? null,
        issueId: meta?.issueId ?? null,
        retries: 0,
        createdAt: now,
        updatedAt: now
      }
    });
    return taskRecordToTask(created);
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
    title?: string;
  }): Promise<TaskGroup> {
    const now = new Date();

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
    repoId?: string;
    robotId?: string;
    kind?: TaskGroup['kind'];
    archived?: 'active' | 'archived' | 'all';
    includeMeta?: boolean;
  }): Promise<TaskGroupWithMeta[]> {
    const take = clampLimit(options?.limit, 50);
    const where: Record<string, any> = {};
    if (options?.repoId) where.repoId = options.repoId;
    if (options?.robotId) where.robotId = options.robotId;
    if (options?.kind) where.kind = options.kind;
    // Exclude archived task groups from default sidebar/chat lists. qnp1mtxhzikhbi0xspbc
    const archiveScope = options?.archived ?? 'active';
    if (archiveScope === 'active') where.archivedAt = null;
    if (archiveScope === 'archived') where.archivedAt = { not: null };

    if (options?.repoId && !isUuidLike(options.repoId)) return [];
    if (options?.robotId && !isUuidLike(options.robotId)) return [];

    const rows = await db.taskGroup.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take
    });

    const groups = rows.map(taskGroupRecordToTaskGroup) as TaskGroupWithMeta[];
    if (!options?.includeMeta) return groups;
    return this.attachGroupMeta(groups);
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

  async listTasksByGroup(
    groupId: string,
    options?: { limit?: number; includeMeta?: boolean }
  ): Promise<TaskWithMeta[]> {
    const id = String(groupId ?? '').trim();
    if (!isUuidLike(id)) return [];
    const take = clampLimit(options?.limit, 50);

    const rows = await db.task.findMany({ where: { groupId: id }, orderBy: { createdAt: 'desc' }, take });
    const tasks = rows.map(taskRecordToTask) as TaskWithMeta[];
    if (!options?.includeMeta) return tasks;
    const withMeta = await this.attachMeta(tasks);
    return this.attachQueueDiagnosis(withMeta);
  }

  async listTasks(options?: TaskListOptions): Promise<TaskWithMeta[]> {
    // Change record (2026-01-12):
    // - Sort by `updated_at` (instead of `created_at`) so the console can surface the most recently updated tasks
    //   (status transitions, retries, log/result patches) at the top.
    const take = clampLimit(options?.limit, 50);
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
      const rows = await db.$queryRaw<any[]>`
        WITH candidates AS (
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND status = 'queued'
           ORDER BY updated_at DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND status = 'processing'
           ORDER BY updated_at DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND status = 'succeeded'
           ORDER BY updated_at DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND status = 'commented'
           ORDER BY updated_at DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND status = 'failed'
           ORDER BY updated_at DESC
           LIMIT ${take})
        )
        SELECT *
        FROM candidates
        ORDER BY updated_at DESC
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
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND status = 'succeeded'
           ORDER BY updated_at DESC
           LIMIT ${take})
          UNION ALL
          (SELECT id, group_id, event_type, status, archived_at, title, project_id, repo_provider, repo_id, robot_id, ref, mr_id, issue_id, retries, created_at, updated_at,
                  jsonb_strip_nulls(jsonb_build_object(
                    'message', NULLIF(result_json->>'message', ''),
                    'summary', NULLIF(result_json->>'summary', ''),
                    'outputText', NULLIF(left(result_json->>'outputText', 4000), ''),
                    'tokenUsage', result_json->'tokenUsage',
                    'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
                  )) AS result_json
           FROM tasks
           WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
             AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
             AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
             AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
             AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
             AND status = 'commented'
           ORDER BY updated_at DESC
           LIMIT ${take})
        )
        SELECT *
        FROM candidates
        ORDER BY updated_at DESC
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
                 'providerCommentUrl', NULLIF(result_json->>'providerCommentUrl', '')
               )) AS result_json
        FROM tasks
        WHERE (${repoId}::uuid IS NULL OR repo_id = ${repoId}::uuid)
          AND (${robotId}::uuid IS NULL OR robot_id = ${robotId}::uuid)
          AND (${eventType}::text IS NULL OR event_type = ${eventType}::text)
          AND (${listAllArchived}::boolean = true OR (${listArchivedOnly}::boolean = true AND archived_at IS NOT NULL) OR (${listArchivedOnly}::boolean = false AND archived_at IS NULL))
          AND (${restrictAllowedRepoIds}::boolean = false OR repo_id = ANY(${allowedRepoIds}::uuid[]))
          AND status = ${status}::text
        ORDER BY updated_at DESC
        LIMIT ${take};
      `;
      tasks = rows.map(rowToTaskFromSql) as TaskWithMeta[];
    }

    if (!options?.includeMeta) return tasks;
    const withMeta = await this.attachMeta(tasks);
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
      if (status === 'queued') stats.queued += count;
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

    const rows = await db.$queryRaw<any[]>`
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

    return rows.map((row) => ({
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

    return rows?.[0] ? rowToTaskFromSql(rows[0]) : undefined;
  }

  async retryTask(id: string): Promise<Task | undefined> {
    const now = new Date();
    try {
      const row = await db.task.update({
        where: { id },
        data: {
          status: 'queued',
          retries: { increment: 1 },
          updatedAt: now
        }
      });
      return taskRecordToTask(row);
    } catch (err) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  async takeNextQueued(): Promise<Task | undefined> {
    const now = new Date();
    // Skip archived tasks so the worker does not process tasks hidden in the Archive area. qnp1mtxhzikhbi0xspbc
    const rows = await db.$queryRaw<any[]>`
      WITH next AS (
        SELECT id
        FROM tasks
        WHERE status = 'queued'
          AND archived_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE tasks t
      SET status = 'processing', updated_at = ${now}
      FROM next
      WHERE t.id = next.id
      RETURNING t.*;
    `;

    return rows?.[0] ? rowToTaskFromSql(rows[0]) : undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.task.deleteMany({ where: { id } });
    return result.count > 0;
  }
}
