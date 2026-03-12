import { createHash, randomBytes, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { db } from '../../db';
import type { TaskResult, TaskStatus } from '../../types/task';
import type { WorkerCapabilities, WorkerRecord, WorkerRuntimeState, WorkerSummary } from '../../types/worker';
import type { WorkerHelloMessage, WorkerHeartbeatMessage } from '../../types/workerProtocol';
import { LogWriterService } from '../logs/log-writer.service';

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const trimString = (value: unknown): string | undefined => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw : undefined;
};

const hashToken = (token: string): string =>
  // Hash worker bootstrap tokens before persisting them so leaked DB rows cannot connect workers. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  createHash('sha256').update(token).digest('hex');

const buildBootstrapToken = (): string =>
  // Generate single-view worker bootstrap tokens so admins can provision remote executors safely. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  randomBytes(24).toString('hex');

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined =>
  // Cast worker protocol payloads into Prisma JSON inputs without loosening the public worker types. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  value == null ? undefined : (value as Prisma.InputJsonValue);

const toJsonInput = <T>(value: T): Prisma.InputJsonValue =>
  // Normalize worker protocol payloads before Prisma writes so executor metadata remains DB-safe. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  value as Prisma.InputJsonValue;

const workerToSummary = (row: any): WorkerSummary => ({
  id: String(row.id),
  name: String(row.name),
  kind: String(row.kind) as WorkerSummary['kind'],
  status: String(row.status) as WorkerSummary['status'],
  preview: Boolean((row.capabilities?.preview ?? row.capabilities_json?.preview) || false)
});

const workerToRecord = (row: any): WorkerRecord => ({
  ...workerToSummary(row),
  systemManaged: Boolean(row.systemManaged ?? row.system_managed),
  version: trimString(row.version),
  platform: trimString(row.platform),
  arch: trimString(row.arch),
  hostname: trimString(row.hostname),
  backendBaseUrl: trimString(row.backendBaseUrl ?? row.backend_base_url),
  capabilities: (row.capabilities ?? row.capabilities_json ?? undefined) as WorkerCapabilities | undefined,
  runtimeState: (row.runtimeState ?? row.runtime_state_json ?? undefined) as WorkerRuntimeState | undefined,
  maxConcurrency: Number(row.maxConcurrency ?? row.max_concurrency ?? 1) || 1,
  currentConcurrency: Number(row.currentConcurrency ?? row.current_concurrency ?? 0) || 0,
  lastSeenAt: row.lastSeenAt ?? row.last_seen_at ? toIso(row.lastSeenAt ?? row.last_seen_at) : undefined,
  lastHelloAt: row.lastHelloAt ?? row.last_hello_at ? toIso(row.lastHelloAt ?? row.last_hello_at) : undefined,
  disabledAt: row.disabledAt ?? row.disabled_at ? toIso(row.disabledAt ?? row.disabled_at) : undefined,
  createdByUserId: trimString(row.createdByUserId ?? row.created_by_user_id),
  createdAt: toIso(row.createdAt ?? row.created_at),
  updatedAt: toIso(row.updatedAt ?? row.updated_at)
});

@Injectable()
export class WorkersService {
  constructor(private readonly logWriter: LogWriterService) {}

  async listWorkers(): Promise<WorkerRecord[]> {
    // Load worker registry rows for the admin settings page and worker-aware selectors. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const rows = await db.worker.findMany({ orderBy: [{ systemManaged: 'desc' }, { createdAt: 'asc' }] });
    return rows.map(workerToRecord);
  }

  async getWorkerById(id: string): Promise<WorkerRecord | null> {
    const row = await db.worker.findUnique({ where: { id } });
    return row ? workerToRecord(row) : null;
  }

  async createRemoteWorker(params: {
    actorUserId?: string;
    name: string;
    maxConcurrency?: number;
  }): Promise<{ worker: WorkerRecord; token: string }> {
    const token = buildBootstrapToken();
    const now = new Date();
    const row = await db.worker.create({
      data: {
        id: randomUUID(),
        name: params.name.trim(),
        kind: 'remote',
        status: 'offline',
        systemManaged: false,
        capabilities: { preview: false },
        maxConcurrency: Number.isFinite(params.maxConcurrency) && Number(params.maxConcurrency) > 0 ? Math.floor(Number(params.maxConcurrency)) : 1,
        currentConcurrency: 0,
        tokenHash: hashToken(token),
        createdByUserId: params.actorUserId,
        createdAt: now,
        updatedAt: now
      }
    });
    // Emit worker bootstrap creation logs so provisioning remains auditable. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    void this.logWriter.logSystem({
      level: 'info',
      message: `Worker created: ${row.name}`,
      code: 'WORKER_CREATED',
      actorUserId: params.actorUserId,
      meta: { workerId: row.id, kind: row.kind, systemManaged: row.systemManaged }
    });
    return { worker: workerToRecord(row), token };
  }

  async ensureLocalSystemWorker(params: {
    name: string;
    backendBaseUrl?: string;
    maxConcurrency?: number;
  }): Promise<{ worker: WorkerRecord; token: string }> {
    const now = new Date();
    const existing = await db.worker.findFirst({ where: { systemManaged: true, kind: 'local' }, orderBy: { createdAt: 'asc' } });
    const token = buildBootstrapToken();
    if (existing) {
      const updated = await db.worker.update({
        where: { id: existing.id },
        data: {
          name: params.name,
          status: 'offline',
          backendBaseUrl: params.backendBaseUrl,
          maxConcurrency: Number.isFinite(params.maxConcurrency) && Number(params.maxConcurrency) > 0 ? Math.floor(Number(params.maxConcurrency)) : existing.maxConcurrency,
          currentConcurrency: 0,
          tokenHash: hashToken(token),
          updatedAt: now
        }
      });
      return { worker: workerToRecord(updated), token };
    }
    const created = await db.worker.create({
      data: {
        id: randomUUID(),
        name: params.name,
        kind: 'local',
        status: 'offline',
        systemManaged: true,
        backendBaseUrl: params.backendBaseUrl,
        capabilities: { preview: true },
        maxConcurrency: Number.isFinite(params.maxConcurrency) && Number(params.maxConcurrency) > 0 ? Math.floor(Number(params.maxConcurrency)) : 2,
        currentConcurrency: 0,
        tokenHash: hashToken(token),
        createdAt: now,
        updatedAt: now
      }
    });
    return { worker: workerToRecord(created), token };
  }

  async bindExternalSystemWorker(params: {
    workerId: string;
    token: string;
    backendBaseUrl?: string;
  }): Promise<WorkerRecord> {
    const now = new Date();
    const configuredTokenHash = hashToken(params.token);
    const existing = await db.worker.findUnique({ where: { id: params.workerId } });
    // Bind external mode to an existing remote worker row so deployments must provision the worker explicitly before backend claims it as default. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
    if (!existing) {
      throw new Error(`Configured external system worker not found: ${params.workerId}`);
    }

    if (existing.kind !== 'remote') {
      throw new Error(`Configured external system worker must be remote: ${params.workerId}`);
    }
    if (existing.disabledAt || existing.status === 'disabled') {
      throw new Error(`Configured external system worker is disabled: ${params.workerId}`);
    }
    if (!existing.tokenHash || existing.tokenHash !== configuredTokenHash) {
      throw new Error(`Configured external system worker token mismatch: ${params.workerId}`);
    }

    // Demote previously claimed remote system workers so backend routing keeps only one configured external default at a time. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
    await db.worker.updateMany({
      where: { kind: 'remote', systemManaged: true, id: { not: params.workerId } },
      data: { systemManaged: false, updatedAt: now }
    });

    const row = await db.worker.update({
      where: { id: params.workerId },
      data: {
        systemManaged: true,
        status: 'offline',
        disabledAt: null,
        backendBaseUrl: params.backendBaseUrl,
        currentConcurrency: 0,
        updatedAt: now
      }
    });

    void this.logWriter.logSystem({
      level: 'info',
      message: `External system worker bound: ${row.name}`,
      code: 'WORKER_SYSTEM_EXTERNAL_BOUND',
      meta: { workerId: row.id, kind: row.kind, systemManaged: row.systemManaged }
    });
    return workerToRecord(row);
  }
  async rotateWorkerToken(id: string): Promise<{ worker: WorkerRecord; token: string } | null> {
    const existing = await db.worker.findUnique({ where: { id } });
    if (!existing) return null;
    const token = buildBootstrapToken();
    const updated = await db.worker.update({
      where: { id },
      data: { tokenHash: hashToken(token), updatedAt: new Date() }
    });
    return { worker: workerToRecord(updated), token };
  }

  async verifyWorkerToken(id: string, token: string): Promise<WorkerRecord | null> {
    const workerId = trimString(id);
    const rawToken = trimString(token);
    if (!workerId || !rawToken) return null;
    const row = await db.worker.findUnique({ where: { id: workerId } });
    if (!row?.tokenHash || row.disabledAt || row.status === 'disabled') return null;
    return row.tokenHash === hashToken(rawToken) ? workerToRecord(row) : null;
  }

  async updateWorker(id: string, patch: { name?: string; status?: 'online' | 'offline' | 'disabled'; maxConcurrency?: number }): Promise<WorkerRecord | null> {
    const existing = await db.worker.findUnique({ where: { id } });
    if (!existing) return null;
    const nextStatus = patch.status ?? (existing.status as WorkerRecord['status']);
    const updated = await db.worker.update({
      where: { id },
      data: {
        name: trimString(patch.name) ?? existing.name,
        status: nextStatus,
        disabledAt: nextStatus === 'disabled' ? new Date() : null,
        maxConcurrency: Number.isFinite(patch.maxConcurrency) && Number(patch.maxConcurrency) > 0 ? Math.floor(Number(patch.maxConcurrency)) : existing.maxConcurrency,
        updatedAt: new Date()
      }
    });
    return workerToRecord(updated);
  }

  async deleteWorker(id: string): Promise<boolean> {
    const existing = await db.worker.findUnique({ where: { id } });
    if (!existing || existing.systemManaged) return false;
    await db.worker.delete({ where: { id } });
    return true;
  }

  async markWorkerOnline(workerId: string, message: WorkerHelloMessage): Promise<WorkerRecord | null> {
    const updated = await db.worker.update({
      where: { id: workerId },
      data: {
        status: 'online',
        version: trimString(message.version),
        platform: trimString(message.platform),
        arch: trimString(message.arch),
        hostname: trimString(message.hostname),
        capabilities: toJsonValue(message.capabilities),
        runtimeState: toJsonValue(message.runtimeState),
        maxConcurrency: Number.isFinite(message.maxConcurrency) && Number(message.maxConcurrency) > 0 ? Math.floor(Number(message.maxConcurrency)) : undefined,
        currentConcurrency: Array.isArray(message.activeTaskIds) ? message.activeTaskIds.length : undefined,
        lastHelloAt: new Date(),
        lastSeenAt: new Date(),
        updatedAt: new Date()
      }
    }).catch(() => null);
    if (!updated) return null;
    void this.logWriter.logSystem({
      level: 'info',
      message: `Worker connected: ${updated.name}`,
      code: 'WORKER_CONNECTED',
      meta: { workerId: updated.id, kind: updated.kind, version: updated.version }
    });
    return workerToRecord(updated);
  }

  async recordHeartbeat(workerId: string, message: WorkerHeartbeatMessage): Promise<void> {
    await db.worker.updateMany({
      where: { id: workerId },
      data: {
        status: 'online',
        currentConcurrency: Array.isArray(message.activeTaskIds) ? message.activeTaskIds.length : undefined,
        runtimeState: toJsonValue(message.runtimeState),
        lastSeenAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async markRuntimePreparing(workerId: string, providers?: string[]): Promise<void> {
    const existing = await db.worker.findUnique({ where: { id: workerId }, select: { runtimeState: true } });
    const runtimeState = (existing?.runtimeState ?? {}) as WorkerRuntimeState;
    await db.worker.updateMany({
      where: { id: workerId },
      data: {
        runtimeState: {
          ...runtimeState,
          preparingProviders: providers ?? runtimeState.preparingProviders ?? [],
          lastPrepareAt: new Date().toISOString(),
          lastPrepareError: undefined
        },
        updatedAt: new Date()
      }
    });
  }

  async markRuntimePrepared(workerId: string, params: { providers?: string[]; runtimeState?: WorkerRuntimeState; error?: string }): Promise<void> {
    const existing = await db.worker.findUnique({ where: { id: workerId }, select: { runtimeState: true } });
    const prior = (existing?.runtimeState ?? {}) as WorkerRuntimeState;
    await db.worker.updateMany({
      where: { id: workerId },
      data: {
        runtimeState: {
          ...prior,
          ...params.runtimeState,
          preparingProviders: [],
          preparedProviders: params.providers ?? params.runtimeState?.preparedProviders ?? prior.preparedProviders ?? [],
          lastPrepareAt: new Date().toISOString(),
          lastPrepareError: trimString(params.error)
        },
        updatedAt: new Date()
      }
    });
  }

  async markWorkerOffline(workerId: string, reason: string): Promise<void> {
    const now = new Date();
    const worker = await db.worker.update({
      where: { id: workerId },
      data: { status: 'offline', currentConcurrency: 0, updatedAt: now }
    }).catch(() => null);
    if (!worker) return;

    const message = `Assigned worker went offline (${reason}). The task cannot continue and must be retried manually.`;
    const processingTasks = await db.task.findMany({
      where: { workerId, status: 'processing', archivedAt: null },
      select: { id: true, repoId: true, groupId: true, retries: true }
    });

    for (const task of processingTasks) {
      // Mark in-flight tasks as failed when their worker disconnects because v1 has no failover/recovery. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      await db.task.updateMany({
        where: { id: task.id, status: 'processing' },
        data: {
          status: 'failed',
          workerLostAt: now,
          result: toJsonValue({
            message,
            workerLost: true,
            workerLostReason: reason,
            workerLostAt: now.toISOString(),
            code: 'WORKER_LOST_DURING_EXECUTION'
          }),
          updatedAt: now
        }
      });
      void this.logWriter.logExecution({
        level: 'error',
        message,
        code: 'WORKER_LOST_DURING_EXECUTION',
        repoId: task.repoId ?? undefined,
        taskId: task.id,
        taskGroupId: task.groupId ?? undefined,
        meta: { workerId, reason }
      });
    }

    void this.logWriter.logSystem({
      level: 'warn',
      message: `Worker offline: ${worker.name}`,
      code: 'WORKER_OFFLINE',
      meta: { workerId: worker.id, reason, failedProcessingTasks: processingTasks.length }
    });
  }

  async reserveWorkerSlot(workerId: string): Promise<void> {
    const existing = await db.worker.findUnique({ where: { id: workerId }, select: { currentConcurrency: true } });
    if (!existing) return;
    // Reserve worker capacity when backend dispatches a task so queue scans respect per-worker concurrency immediately. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    await db.worker.update({
      where: { id: workerId },
      data: { currentConcurrency: Math.max(0, Number(existing.currentConcurrency ?? 0)) + 1, updatedAt: new Date() }
    });
  }

  async releaseWorkerSlot(workerId: string): Promise<void> {
    const existing = await db.worker.findUnique({ where: { id: workerId }, select: { currentConcurrency: true } });
    if (!existing) return;
    await db.worker.update({
      where: { id: workerId },
      data: { currentConcurrency: Math.max(0, Number(existing.currentConcurrency ?? 0) - 1), updatedAt: new Date() }
    });
  }

  async recordTaskAccepted(workerId: string, _taskId: string): Promise<void> {
    await db.worker.updateMany({
      where: { id: workerId },
      data: { lastSeenAt: new Date(), updatedAt: new Date() }
    });
  }

  async findEffectiveWorkerId(params: { requestedWorkerId?: string | null; taskGroupId?: string | null; robotId?: string | null }): Promise<string | null> {
    const taskGroupId = trimString(params.taskGroupId);
    if (taskGroupId) {
      // Keep existing task groups pinned to their original worker so shared workspaces never jump hosts mid-thread. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      const taskGroup = await db.taskGroup.findUnique({ where: { id: taskGroupId }, select: { workerId: true } });
      const taskGroupWorkerId = trimString(taskGroup?.workerId);
      if (taskGroupWorkerId) return taskGroupWorkerId;
    }

    const requestedWorkerId = trimString(params.requestedWorkerId);
    if (requestedWorkerId) return requestedWorkerId;

    const robotId = trimString(params.robotId);
    if (robotId) {
      const robot = await db.repoRobot.findUnique({ where: { id: robotId }, select: { defaultWorkerId: true } });
      const robotWorkerId = trimString(robot?.defaultWorkerId);
      if (robotWorkerId) return robotWorkerId;
    }

    // Prefer online system-managed workers first so Docker/production can fall back to the configured external worker when a stale local row exists in the shared DB. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const systemWorkers = await db.worker.findMany({
      where: { systemManaged: true, disabledAt: null },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, kind: true, status: true }
    });
    const firstOnlineLocal = systemWorkers.find((worker) => worker.kind === 'local' && worker.status === 'online');
    if (firstOnlineLocal?.id) return trimString(firstOnlineLocal.id) ?? null;
    const firstOnlineRemote = systemWorkers.find((worker) => worker.kind === 'remote' && worker.status === 'online');
    if (firstOnlineRemote?.id) return trimString(firstOnlineRemote.id) ?? null;
    const firstLocal = systemWorkers.find((worker) => worker.kind === 'local');
    if (firstLocal?.id) return trimString(firstLocal.id) ?? null;
    const firstRemote = systemWorkers.find((worker) => worker.kind === 'remote');
    return trimString(firstRemote?.id) ?? null;
  }

  async isWorkerOnline(id: string): Promise<boolean> {
    const worker = await db.worker.findUnique({ where: { id }, select: { status: true, disabledAt: true } });
    return Boolean(worker && worker.status === 'online' && !worker.disabledAt);
  }

  async attachWorkerSummaries<T extends { workerId?: string | null }>(rows: T[]): Promise<Array<T & { workerSummary?: WorkerSummary }>> {
    const workerIds = Array.from(new Set(rows.map((row) => trimString(row.workerId)).filter(Boolean))) as string[];
    if (!workerIds.length) return rows.map((row) => ({ ...row }));
    const workers = await db.worker.findMany({ where: { id: { in: workerIds } } });
    const workerMap = new Map(workers.map((worker) => [String(worker.id), workerToSummary(worker)] as const));
    return rows.map((row) => ({
      ...row,
      workerSummary: row.workerId ? workerMap.get(String(row.workerId)) : undefined
    }));
  }

  async requireWorkerReadyForNewTask(workerId: string): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    const worker = await db.worker.findUnique({ where: { id: workerId }, select: { status: true, disabledAt: true, name: true } });
    if (!worker) {
      return { ok: false, code: 'WORKER_NOT_FOUND', message: 'Selected worker not found' };
    }
    if (worker.disabledAt || worker.status === 'disabled') {
      return { ok: false, code: 'WORKER_DISABLED', message: 'Selected worker is disabled' };
    }
    if (worker.status !== 'online') {
      return { ok: false, code: 'WORKER_OFFLINE_TASK_GROUP_BLOCKED', message: `Selected worker is offline: ${worker.name}` };
    }
    return { ok: true };
  }
}
