import { randomBytes, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { db } from '../../db';
import type {
  WorkerApiKeyInfo,
  WorkerCapabilities,
  WorkerProviderKey,
  WorkerRecord,
  WorkerSummary,
} from '../../types/worker';
import type { WorkerHeartbeatRequest, WorkerPollRequest } from '../../types/workerProtocol';
import { parsePositiveInt } from '../../utils/parse';
import { hashToken } from '../../utils/token';
import { LogWriterService } from '../logs/log-writer.service';

const API_KEY_PREFIX = 'hkw_';

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const trimString = (value: unknown): string | undefined => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw : undefined;
};

const generateApiKey = (): string =>
  `${API_KEY_PREFIX}${randomBytes(32).toString('hex')}`;

const resolveHeartbeatTimeoutMs = (env: NodeJS.ProcessEnv = process.env): number =>
  parsePositiveInt(env.WORKER_HEARTBEAT_TIMEOUT_MS, 60_000);

const isHeartbeatFresh = (
  lastHeartbeatAt?: Date | string | null,
  now = new Date(),
  env: NodeJS.ProcessEnv = process.env
): boolean => {
  if (!lastHeartbeatAt) return false;
  const timestamp = lastHeartbeatAt instanceof Date ? lastHeartbeatAt.getTime() : new Date(lastHeartbeatAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return now.getTime() - timestamp <= resolveHeartbeatTimeoutMs(env);
};

const normalizeProviderKey = (key: unknown): WorkerProviderKey | null => {
  const raw = typeof key === 'string' ? key.trim().toLowerCase() : '';
  if (raw === 'codex' || raw === 'claude_code' || raw === 'gemini_cli') return raw;
  return null;
};

const workerToSummary = (row: any): WorkerSummary => ({
  id: String(row.id),
  name: String(row.name),
  kind: String(row.kind) as WorkerSummary['kind'],
  status: String(row.status) as WorkerSummary['status'],
  isGlobalDefault: Boolean(row.isGlobalDefault ?? row.is_global_default),
  preview: Boolean((row.capabilities?.preview ?? row.capabilities_json?.preview) || false),
  providers: Array.isArray(row.providers) ? row.providers : [],
});

const workerToRecord = (row: any): WorkerRecord => ({
  ...workerToSummary(row),
  version: trimString(row.version),
  platform: trimString(row.platform),
  arch: trimString(row.arch),
  hostname: trimString(row.hostname),
  capabilities: (row.capabilities ?? row.capabilities_json ?? undefined) as WorkerCapabilities | undefined,
  maxConcurrency: Number(row.maxConcurrency ?? row.max_concurrency ?? 1) || 1,
  activeTaskCount: Number(row.activeTaskCount ?? row.active_task_count ?? 0) || 0,
  lastHeartbeatAt: row.lastHeartbeatAt ?? row.last_heartbeat_at ? toIso(row.lastHeartbeatAt ?? row.last_heartbeat_at) : undefined,
  disabledAt: row.disabledAt ?? row.disabled_at ? toIso(row.disabledAt ?? row.disabled_at) : undefined,
  createdByUserId: trimString(row.createdByUserId ?? row.created_by_user_id),
  createdAt: toIso(row.createdAt ?? row.created_at),
  updatedAt: toIso(row.updatedAt ?? row.updated_at),
});

@Injectable()
export class WorkersService {
  constructor(private readonly logWriter: LogWriterService) {}

  // ── List / Get ──

  async listWorkers(): Promise<WorkerRecord[]> {
    const rows = await db.worker.findMany({
      orderBy: [{ isGlobalDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(workerToRecord);
  }

  async getWorkerById(id: string): Promise<WorkerRecord | null> {
    const row = await db.worker.findUnique({ where: { id } });
    return row ? workerToRecord(row) : null;
  }

  // ── Create / Delete ──

  async createRemoteWorker(params: {
    actorUserId?: string;
    name: string;
    maxConcurrency?: number;
    providers?: string[];
  }): Promise<WorkerApiKeyInfo> {
    const now = new Date();
    const apiKey = generateApiKey();
    const providers = (params.providers ?? []).map(normalizeProviderKey).filter(Boolean) as WorkerProviderKey[];
    const row = await db.worker.create({
      data: {
        id: randomUUID(),
        name: params.name.trim(),
        kind: 'remote',
        status: 'offline',
        systemManaged: false,
        providers,
        capabilities: { preview: false } as any,
        maxConcurrency: Number.isFinite(params.maxConcurrency) && Number(params.maxConcurrency) > 0
          ? Math.floor(Number(params.maxConcurrency)) : 1,
        activeTaskCount: 0,
        apiKeyHash: hashToken(apiKey),
        apiKeyPrefix: apiKey.substring(0, API_KEY_PREFIX.length + 8),
        createdByUserId: params.actorUserId,
        createdAt: now,
        updatedAt: now,
      },
    });
    void this.logWriter.logSystem({
      level: 'info',
      message: `Worker created: ${row.name}`,
      code: 'WORKER_CREATED',
      actorUserId: params.actorUserId,
      meta: { workerId: row.id, kind: row.kind },
    });
    return { worker: workerToRecord(row), apiKey };
  }

  async deleteWorker(id: string): Promise<boolean> {
    const existing = await db.worker.findUnique({ where: { id } });
    if (!existing) return false;
    await db.worker.delete({ where: { id } });
    return true;
  }

  // ── Auth ──

  async authenticateByApiKey(apiKey: string): Promise<WorkerRecord | null> {
    if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) return null;
    const hash = hashToken(apiKey);
    const row = await db.worker.findFirst({ where: { apiKeyHash: hash } });
    if (!row || row.disabledAt || row.status === 'disabled') return null;
    return workerToRecord(row);
  }

  async rotateApiKey(id: string): Promise<WorkerApiKeyInfo | null> {
    const existing = await db.worker.findUnique({ where: { id } });
    if (!existing) return null;
    const apiKey = generateApiKey();
    const updated = await db.worker.update({
      where: { id },
      data: {
        apiKeyHash: hashToken(apiKey),
        apiKeyPrefix: apiKey.substring(0, API_KEY_PREFIX.length + 8),
        updatedAt: new Date(),
      },
    });
    return { worker: workerToRecord(updated), apiKey };
  }

  // ── Update ──

  async updateWorker(
    id: string,
    patch: { name?: string; status?: 'online' | 'offline' | 'disabled'; maxConcurrency?: number; isGlobalDefault?: boolean; providers?: string[] }
  ): Promise<WorkerRecord | null> {
    const existing = await db.worker.findUnique({ where: { id } });
    if (!existing) return null;
    const now = new Date();
    const nextStatus = patch.status ?? (existing.status as WorkerRecord['status']);
    if (patch.isGlobalDefault === true) {
      await db.worker.updateMany({
        where: { isGlobalDefault: true, NOT: { id } },
        data: { isGlobalDefault: false, updatedAt: now },
      });
    }
    const providers = patch.providers
      ? (patch.providers.map(normalizeProviderKey).filter(Boolean) as WorkerProviderKey[])
      : undefined;
    const updated = await db.worker.update({
      where: { id },
      data: {
        name: trimString(patch.name) ?? existing.name,
        status: nextStatus,
        disabledAt: nextStatus === 'disabled' ? new Date() : null,
        maxConcurrency: Number.isFinite(patch.maxConcurrency) && Number(patch.maxConcurrency) > 0
          ? Math.floor(Number(patch.maxConcurrency)) : existing.maxConcurrency,
        isGlobalDefault: patch.isGlobalDefault ?? existing.isGlobalDefault,
        ...(providers !== undefined ? { providers } : {}),
        updatedAt: now,
      },
    });
    return workerToRecord(updated);
  }

  // ── Heartbeat & Online ──

  async recordHeartbeat(workerId: string, message: WorkerHeartbeatRequest): Promise<void> {
    const providers = message.providers
      ? (message.providers.map(normalizeProviderKey).filter(Boolean) as WorkerProviderKey[])
      : undefined;
    await db.worker.updateMany({
      where: { id: workerId },
      data: {
        status: 'online',
        activeTaskCount: Array.isArray(message.activeTaskIds) ? message.activeTaskIds.length : undefined,
        lastHeartbeatAt: new Date(),
        ...(message.version ? { version: message.version } : {}),
        ...(providers !== undefined ? { providers } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async markWorkerOnlineFromPoll(workerId: string, message: WorkerPollRequest): Promise<void> {
    const providers = message.providers
      ? (message.providers.map(normalizeProviderKey).filter(Boolean) as WorkerProviderKey[])
      : undefined;
    await db.worker.updateMany({
      where: { id: workerId },
      data: {
        status: 'online',
        activeTaskCount: Array.isArray(message.activeTaskIds) ? message.activeTaskIds.length : undefined,
        lastHeartbeatAt: new Date(),
        ...(message.version ? { version: message.version } : {}),
        ...(message.platform ? { platform: message.platform } : {}),
        ...(message.arch ? { arch: message.arch } : {}),
        ...(message.hostname ? { hostname: message.hostname } : {}),
        ...(message.capabilities ? { capabilities: message.capabilities as any } : {}),
        ...(providers !== undefined ? { providers } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async markWorkerOffline(workerId: string, reason: string): Promise<void> {
    const now = new Date();
    const current = await db.worker.findUnique({
      where: { id: workerId },
      select: { status: true, disabledAt: true, name: true },
    });
    if (!current) return;
    const worker = await db.worker.update({
      where: { id: workerId },
      data: {
        status: current.disabledAt || current.status === 'disabled' ? 'disabled' : 'offline',
        activeTaskCount: 0,
        updatedAt: now,
      },
    }).catch(() => null);
    if (!worker) return;

    // Fail in-flight tasks when worker goes offline
    const message = `Assigned worker went offline (${reason}). The task must be retried manually.`;
    const processingTasks = await db.task.findMany({
      where: { workerId, status: 'processing', archivedAt: null },
      select: { id: true, repoId: true, groupId: true },
    });
    for (const task of processingTasks) {
      await db.task.updateMany({
        where: { id: task.id, status: 'processing' },
        data: {
          status: 'failed',
          result: {
            message,
            workerLost: true,
            workerLostReason: reason,
            workerLostAt: now.toISOString(),
            code: 'WORKER_LOST_DURING_EXECUTION',
          } as any,
          updatedAt: now,
        },
      });
      void this.logWriter.logExecution({
        level: 'error',
        message,
        code: 'WORKER_LOST_DURING_EXECUTION',
        repoId: task.repoId ?? undefined,
        taskId: task.id,
        taskGroupId: task.groupId ?? undefined,
        meta: { workerId, reason },
      });
    }

    void this.logWriter.logSystem({
      level: 'warn',
      message: `Worker offline: ${current.name}`,
      code: 'WORKER_OFFLINE',
      meta: { workerId, reason, failedProcessingTasks: processingTasks.length },
    });
  }

  // ── Atomic Concurrency Control ──

  /**
   * Atomically claim a task for a worker using a single SQL UPDATE.
   * Returns the claimed task or null if no eligible task is available.
   */
  async claimNextTask(workerId: string): Promise<{ taskId: string } | null> {
    // Atomic: only claim if worker has capacity
    const rows: Array<{ id: string }> = await db.$queryRaw`
      UPDATE tasks
      SET status = 'processing', worker_id = ${workerId}::uuid, updated_at = NOW()
      WHERE id = (
        SELECT t.id FROM tasks t
        WHERE t.status = 'queued'
          AND (t.worker_id IS NULL OR t.worker_id = ${workerId}::uuid)
          AND t.archived_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM tasks active
            WHERE active.status = 'processing'
              AND active.group_id IS NOT NULL
              AND active.group_id = t.group_id
          )
        ORDER BY t.group_order ASC NULLS LAST, t.created_at ASC, t.id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `;

    if (rows.length === 0) return null;

    // Increment active task count atomically
    await db.$executeRaw`
      UPDATE workers
      SET active_task_count = active_task_count + 1, updated_at = NOW()
      WHERE id = ${workerId}::uuid AND active_task_count < max_concurrency
    `;

    return { taskId: rows[0].id };
  }

  /**
   * Release a task slot after finalization.
   */
  async releaseWorkerSlot(workerId: string): Promise<void> {
    await db.$executeRaw`
      UPDATE workers
      SET active_task_count = GREATEST(0, active_task_count - 1), updated_at = NOW()
      WHERE id = ${workerId}::uuid
    `;
  }

  /**
   * Check if worker has capacity for new tasks.
   */
  async hasCapacity(workerId: string): Promise<boolean> {
    const row = await db.worker.findUnique({
      where: { id: workerId },
      select: { activeTaskCount: true, maxConcurrency: true },
    });
    if (!row) return false;
    return row.activeTaskCount < row.maxConcurrency;
  }

  // ── Stale Worker & Task Recovery ──

  async reconcileStaleWorkers(now = new Date()): Promise<number> {
    const onlineWorkers = await db.worker.findMany({
      where: { status: 'online', disabledAt: null },
      select: { id: true, lastHeartbeatAt: true },
    });
    const staleWorkers = onlineWorkers.filter((w) => !isHeartbeatFresh(w.lastHeartbeatAt, now));
    for (const worker of staleWorkers) {
      await this.markWorkerOffline(String(worker.id), 'heartbeat_timeout');
    }
    return staleWorkers.length;
  }

  // ── Worker Selection ──

  async findEffectiveWorkerId(params: {
    requestedWorkerId?: string | null;
    taskGroupId?: string | null;
    robotId?: string | null;
  }): Promise<string | null> {
    const taskGroupId = trimString(params.taskGroupId);
    if (taskGroupId) {
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

    const globalDefaultWorker = await db.worker.findFirst({
      where: { isGlobalDefault: true },
      select: { id: true },
    });
    const globalDefaultWorkerId = trimString(globalDefaultWorker?.id);
    return globalDefaultWorkerId ?? null;
  }

  async isWorkerOnline(id: string): Promise<boolean> {
    const worker = await db.worker.findUnique({
      where: { id },
      select: { status: true, disabledAt: true, lastHeartbeatAt: true },
    });
    return Boolean(
      worker &&
      worker.status === 'online' &&
      !worker.disabledAt &&
      isHeartbeatFresh(worker.lastHeartbeatAt)
    );
  }

  async attachWorkerSummaries<T extends { workerId?: string | null }>(
    rows: T[]
  ): Promise<Array<T & { workerSummary?: WorkerSummary }>> {
    const workerIds = Array.from(
      new Set(rows.map((row) => trimString(row.workerId)).filter(Boolean))
    ) as string[];
    if (!workerIds.length) return rows.map((row) => ({ ...row }));
    const workers = await db.worker.findMany({ where: { id: { in: workerIds } } });
    const workerMap = new Map(workers.map((w) => [String(w.id), workerToSummary(w)] as const));
    return rows.map((row) => ({
      ...row,
      workerSummary: row.workerId ? workerMap.get(String(row.workerId)) : undefined,
    }));
  }

  async requireWorkerReadyForNewTask(
    workerId: string,
    provider?: string | null
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    const worker = await db.worker.findUnique({
      where: { id: workerId },
      select: { status: true, disabledAt: true, name: true, lastHeartbeatAt: true, providers: true },
    });
    if (!worker) {
      return { ok: false, code: 'WORKER_NOT_FOUND', message: 'Selected worker not found' };
    }
    if (worker.disabledAt || worker.status === 'disabled') {
      return { ok: false, code: 'WORKER_DISABLED', message: 'Selected worker is disabled' };
    }
    if (worker.status !== 'online' || !isHeartbeatFresh(worker.lastHeartbeatAt)) {
      return { ok: false, code: 'WORKER_OFFLINE', message: `Selected worker is offline: ${worker.name}` };
    }
    const normalizedProvider = normalizeProviderKey(provider);
    if (!normalizedProvider) return { ok: true };
    if (worker.providers.includes(normalizedProvider)) return { ok: true };
    return {
      ok: false,
      code: 'WORKER_PROVIDER_NOT_AVAILABLE',
      message: `Worker "${worker.name}" does not support provider: ${normalizedProvider}`,
    };
  }
}

