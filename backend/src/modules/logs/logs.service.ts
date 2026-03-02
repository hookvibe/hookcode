import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { EventStreamService } from '../events/event-stream.service';
import type { SystemLogCategory, SystemLogEntry, SystemLogLevel } from '../../types/systemLog';
import type { CreatedAtCursor } from '../../utils/pagination';
import { encodeCreatedAtCursor } from '../../utils/pagination';

export interface CreateSystemLogInput {
  category: SystemLogCategory;
  level: SystemLogLevel;
  message: string;
  code?: string;
  actorUserId?: string;
  repoId?: string;
  taskId?: string;
  taskGroupId?: string;
  meta?: unknown;
}

export interface ListSystemLogsParams {
  limit: number;
  cursor?: CreatedAtCursor | null;
  category?: SystemLogCategory | null;
  level?: SystemLogLevel | null;
  repoId?: string | null;
  taskId?: string | null;
  taskGroupId?: string | null;
  query?: string | null;
}

export interface ListSystemLogsResult {
  logs: SystemLogEntry[];
  nextCursor?: string;
}

@Injectable()
// Persist and stream system logs for admin observability. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export class LogsService {
  constructor(private readonly eventStream: EventStreamService) {}

  async createLog(input: CreateSystemLogInput): Promise<SystemLogEntry> {
    const row = await db.systemLog.create({
      data: {
        id: randomUUID(),
        category: input.category,
        level: input.level,
        message: input.message,
        code: input.code ?? null,
        actorUserId: input.actorUserId ?? null,
        repoId: input.repoId ?? null,
        taskId: input.taskId ?? null,
        taskGroupId: input.taskGroupId ?? null,
        meta: input.meta === undefined ? undefined : (input.meta as any)
      }
    });

    const entry = this.toEntry(row);
    this.eventStream.publish({ topic: 'logs', event: 'log', data: entry });
    return entry;
  }

  async listLogs(params: ListSystemLogsParams): Promise<ListSystemLogsResult> {
    const take = Math.min(Math.max(params.limit || 50, 1), 200);
    const cursor = params.cursor ?? undefined;

    const where: any = {
      ...(params.category ? { category: params.category } : null),
      ...(params.level ? { level: params.level } : null),
      ...(params.repoId ? { repoId: params.repoId } : null),
      ...(params.taskId ? { taskId: params.taskId } : null),
      ...(params.taskGroupId ? { taskGroupId: params.taskGroupId } : null)
    };

    const andFilters: any[] = [];
    if (params.query) {
      const q = params.query;
      andFilters.push({
        OR: [
          { message: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } }
        ]
      });
    }

    if (cursor) {
      andFilters.push({
        OR: [
          {
            createdAt: {
              lt: cursor.createdAt
            }
          },
          {
            createdAt: cursor.createdAt,
            id: { lt: cursor.id }
          }
        ]
      });
    }

    if (andFilters.length > 0) {
      // Combine query filters with pagination cursor constraints. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      where.AND = andFilters;
    }

    const rows = await db.systemLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1
    });

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const logs = sliced.map((row) => this.toEntry(row));
    const last = sliced[sliced.length - 1];
    const nextCursor = hasMore && last ? encodeCreatedAtCursor({ id: last.id, createdAt: last.createdAt }) : undefined;

    return { logs, ...(nextCursor ? { nextCursor } : {}) };
  }

  async purgeExpired(before: Date): Promise<number> {
    const result = await db.systemLog.deleteMany({
      where: {
        createdAt: { lt: before }
      }
    });
    return result.count;
  }

  private toEntry(row: any): SystemLogEntry {
    return {
      id: String(row.id),
      category: row.category,
      level: row.level,
      message: row.message,
      code: row.code ?? undefined,
      actorUserId: row.actorUserId ?? undefined,
      repoId: row.repoId ?? undefined,
      taskId: row.taskId ?? undefined,
      taskGroupId: row.taskGroupId ?? undefined,
      meta: row.meta ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
    };
  }
}
