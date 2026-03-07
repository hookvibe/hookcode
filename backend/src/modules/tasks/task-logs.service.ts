import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { isUuidLike } from '../../utils/uuid';

export interface TaskLogsPage {
  logs: string[];
  startSeq: number;
  endSeq: number;
  nextBefore?: number;
}

// Carry per-line sequence metadata for SSE append payloads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
export interface TaskLogEntry {
  seq: number;
  line: string;
}

export interface TaskLogsAppend {
  entries: TaskLogEntry[];
  startSeq: number;
  endSeq: number;
}

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 1000;
const BATCH_WRITE_SIZE = 10; // Buffer log writes to reduce DB round trips. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
const BATCH_WRITE_FLUSH_MS = 500; // Flush buffered logs every 500ms to balance latency and throughput. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306

const clampLimit = (value: number | undefined, fallback: number): number => {
  const raw = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(Math.max(raw, 1), MAX_PAGE_SIZE);
};

interface PendingLogWrite {
  taskId: string;
  seq: number;
  line: string;
}

@Injectable()
// Centralize task log storage and pagination for the task_logs table. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
export class TaskLogsService {
  private pendingWrites: PendingLogWrite[] = []; // Buffer log writes for batch insertion. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
  private flushTimer: NodeJS.Timeout | null = null; // Auto-flush timer for batched writes. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306

  // Persist a single log line with its sequence number for paging and SSE. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  async appendLog(taskId: string, seq: number, line: string): Promise<void> {
    if (!isUuidLike(taskId)) return;
    const safeSeq = Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : null;
    if (!safeSeq) return;
    // Buffer writes and flush in batches to reduce DB overhead. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
    this.pendingWrites.push({ taskId, seq: safeSeq, line });
    if (this.pendingWrites.length >= BATCH_WRITE_SIZE) {
      await this.flushPendingWrites();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => void this.flushPendingWrites(), BATCH_WRITE_FLUSH_MS);
    }
  }

  // Flush buffered log writes to the database in a single batch insert. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
  private async flushPendingWrites(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.pendingWrites.length) return;
    const batch = this.pendingWrites.splice(0, this.pendingWrites.length);
    try {
      await db.taskLog.createMany({
        data: batch.map((entry) => ({
          id: randomUUID(),
          taskId: entry.taskId,
          seq: entry.seq,
          line: entry.line
        })),
        skipDuplicates: true
      });
    } catch (err) {
      console.error('[task-logs] batch write failed', { count: batch.length, error: err });
    }
  }

  // Clear stored log lines for a task when users request log deletion. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  async clearLogs(taskId: string): Promise<number> {
    if (!isUuidLike(taskId)) return 0;
    const result = await db.taskLog.deleteMany({ where: { taskId } });
    return Number(result.count ?? 0) || 0;
  }

  // Fetch the newest log lines for initial UI rendering and SSE init payloads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  async getTail(taskId: string, limit?: number): Promise<TaskLogsPage> {
    if (!isUuidLike(taskId)) return { logs: [], startSeq: 0, endSeq: 0 };
    const take = clampLimit(limit, DEFAULT_PAGE_SIZE);
    const startTime = Date.now(); // Add performance timing to identify slow log queries. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
    const rows = await db.taskLog.findMany({
      where: { taskId },
      orderBy: { seq: 'desc' },
      take: take + 1
    });
    const queryTime = Date.now() - startTime; // Log query performance for optimization tracking. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
    if (queryTime > 200) {
      console.warn(`[task-logs] getTail slow query: ${queryTime}ms (taskId=${taskId}, limit=${take})`);
    }
    const hasMore = rows.length > take;
    const slice = hasMore ? rows.slice(0, take) : rows;
    const sorted = slice.slice().reverse();
    const logs = sorted.map((row) => row.line);
    const startSeq = sorted[0]?.seq ?? 0;
    const endSeq = sorted[sorted.length - 1]?.seq ?? 0;
    return {
      logs,
      startSeq,
      endSeq,
      ...(hasMore && startSeq > 0 ? { nextBefore: startSeq } : {})
    };
  }

  // Fetch earlier log lines before a sequence number for "load earlier" paging. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  async getBefore(taskId: string, beforeSeq: number, limit?: number): Promise<TaskLogsPage> {
    if (!isUuidLike(taskId)) return { logs: [], startSeq: 0, endSeq: 0 };
    const before = Number.isFinite(beforeSeq) ? Math.floor(beforeSeq) : 0;
    if (before <= 1) return { logs: [], startSeq: 0, endSeq: 0 };
    const take = clampLimit(limit, DEFAULT_PAGE_SIZE);
    const startTime = Date.now(); // Add performance timing to identify slow log queries. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
    const rows = await db.taskLog.findMany({
      where: { taskId, seq: { lt: before } },
      orderBy: { seq: 'desc' },
      take: take + 1
    });
    const queryTime = Date.now() - startTime; // Log query performance for optimization tracking. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
    if (queryTime > 200) {
      console.warn(`[task-logs] getBefore slow query: ${queryTime}ms (taskId=${taskId}, before=${before}, limit=${take})`);
    }
    const hasMore = rows.length > take;
    const slice = hasMore ? rows.slice(0, take) : rows;
    const sorted = slice.slice().reverse();
    const logs = sorted.map((row) => row.line);
    const startSeq = sorted[0]?.seq ?? 0;
    const endSeq = sorted[sorted.length - 1]?.seq ?? 0;
    return {
      logs,
      startSeq,
      endSeq,
      ...(hasMore && startSeq > 0 ? { nextBefore: startSeq } : {})
    };
  }

  // Fetch new log lines after a sequence number for polling-based SSE updates. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  async getAfter(taskId: string, afterSeq: number, limit?: number): Promise<TaskLogsAppend> {
    if (!isUuidLike(taskId)) return { entries: [], startSeq: 0, endSeq: 0 };
    const after = Number.isFinite(afterSeq) ? Math.floor(afterSeq) : 0;
    const take = clampLimit(limit, DEFAULT_PAGE_SIZE);
    const rows = await db.taskLog.findMany({
      where: { taskId, seq: { gt: after } },
      orderBy: { seq: 'asc' },
      take,
      select: { seq: true, line: true }
    });
    const entries = rows.map((row) => ({ seq: row.seq, line: row.line }));
    const startSeq = rows[0]?.seq ?? 0;
    const endSeq = rows[rows.length - 1]?.seq ?? 0;
    return { entries, startSeq, endSeq };
  }

  // Read the maximum stored sequence number to detect log clears. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  async getMaxSeq(taskId: string): Promise<number> {
    if (!isUuidLike(taskId)) return 0;
    const result = await db.taskLog.aggregate({
      where: { taskId },
      _max: { seq: true }
    });
    return result._max.seq ?? 0;
  }

  // Flush any pending batched writes before shutdown to prevent data loss. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
  async onModuleDestroy() {
    await this.flushPendingWrites();
  }
}
