import { Injectable } from '@nestjs/common';
import type { SystemLogCategory, SystemLogLevel } from '../../types/systemLog';
import { LogsService } from './logs.service';

export interface LogWriterInput {
  level: SystemLogLevel;
  message: string;
  code?: string;
  actorUserId?: string;
  repoId?: string;
  taskId?: string;
  taskGroupId?: string;
  meta?: unknown;
}

const SENSITIVE_KEY = /(token|password|secret|apiKey|authorization)/i;
const MAX_DEPTH = 6;
const MAX_COLLECTION = 50;
const MAX_STRING = 1000;

@Injectable()
// Centralize log writes so new features always emit audit/system entries. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export class LogWriterService {
  // Throttle log write failure reports to avoid noisy output during outages. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  private lastErrorAt = 0;
  private suppressedErrors = 0;

  constructor(private readonly logsService: LogsService) {}

  async logSystem(input: LogWriterInput): Promise<void> {
    await this.write('system', input);
  }

  async logOperation(input: LogWriterInput): Promise<void> {
    await this.write('operation', input);
  }

  async logExecution(input: LogWriterInput): Promise<void> {
    await this.write('execution', input);
  }

  private async write(category: SystemLogCategory, input: LogWriterInput): Promise<void> {
    try {
      await this.logsService.createLog({
        category,
        level: input.level,
        message: input.message,
        code: input.code,
        actorUserId: input.actorUserId,
        repoId: input.repoId,
        taskId: input.taskId,
        taskGroupId: input.taskGroupId,
        meta: input.meta === undefined ? undefined : this.sanitizeMeta(input.meta)
      });
    } catch (err) {
      // Best-effort logging: never let audit failures break core flows. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      const now = Date.now();
      if (now - this.lastErrorAt > 60_000) {
        if (this.suppressedErrors > 0) {
          console.error(`[logs] suppressed ${this.suppressedErrors} log write errors`);
        }
        this.lastErrorAt = now;
        this.suppressedErrors = 0;
        console.error('[logs] log write failed', err);
      } else {
        this.suppressedErrors += 1;
      }
    }
  }

  private sanitizeMeta(value: unknown): unknown {
    const seen = new WeakSet<object>();
    const walk = (input: unknown, depth: number): unknown => {
      if (depth > MAX_DEPTH) return '[truncated]';
      if (input === null || input === undefined) return input;
      if (typeof input === 'string') return input.length > MAX_STRING ? `${input.slice(0, MAX_STRING)}…` : input;
      if (typeof input === 'number' || typeof input === 'boolean') return input;
      if (input instanceof Error) return { name: input.name, message: input.message };
      if (Array.isArray(input)) {
        return input.slice(0, MAX_COLLECTION).map((item) => walk(item, depth + 1));
      }
      if (typeof input === 'object') {
        if (seen.has(input as object)) return '[circular]';
        seen.add(input as object);
        const entries = Object.entries(input as Record<string, unknown>).slice(0, MAX_COLLECTION);
        const next: Record<string, unknown> = {};
        for (const [key, val] of entries) {
          if (SENSITIVE_KEY.test(key)) {
            next[key] = '[redacted]';
            continue;
          }
          next[key] = walk(val, depth + 1);
        }
        return next;
      }
      return String(input);
    };

    return walk(value, 0);
  }
}
