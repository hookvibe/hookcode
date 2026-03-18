/**
 * Standalone Worker process entry (no HTTP):
 * - Kept for legacy backend-local execution flows; the standalone packaged worker now lives in `@hookvibe/hookcode-worker`.
 * - Polls the DB queue (see `backend/src/services/taskService.ts`) and consumes tasks in parallel across task groups via `backend/src/services/taskRunner.ts`. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
 * - On startup, recovers "stuck" processing tasks (avoids tasks being permanently stuck in processing after API/worker restarts);
 *   see `TaskService.recoverStaleProcessing`.
 * - The Webhook/API process can also trigger an inline worker (see INLINE_WORKER_ENABLED in `backend/src/routes/webhook.ts` and `backend/src/routes/tasks.ts`).
 */
import dotenv from 'dotenv';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ensureSchema, closeDb } from './db';
import { TaskRunner } from './modules/tasks/task-runner.service';
import { TaskService } from './modules/tasks/task.service';
import { WorkerModule } from './modules/worker/worker.module';
import { isPreferredWorkerPresent, tryAcquirePreferredWorkerLock, type PreferredWorkerLockHandle } from './services/workerPriority';
import { RuntimeService } from './services/runtimeService';
import { LogWriterService } from './modules/logs/log-writer.service';
import { parseOptionalDurationMs } from './utils/env';

dotenv.config();

// Help diagnose "silent exits" (e.g., signal termination, unexpected promise rejections).
process.on('uncaughtException', (err) => {
  console.error('[worker] uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[worker] unhandledRejection', reason);
});

let app: INestApplicationContext | null = null;
let preferredLock: PreferredWorkerLockHandle | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toNumber = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return fallback;
};

const main = async () => {
  const pollIntervalMs = toNumber(process.env.WORKER_POLL_INTERVAL_MS, 2000);
  // Respect blank/zero PROCESSING_STALE_MS to disable stale recovery in the worker. docs/en/developer/plans/stale-disable-20260305/task_plan.md stale-disable-20260305
  const staleMs = parseOptionalDurationMs(process.env.PROCESSING_STALE_MS, 30 * 60 * 1000);
  const preferWorker = toBoolean(process.env.WORKER_PREFERRED, false);
  const backoffOnPreferred = toBoolean(process.env.WORKER_BACKOFF_ON_PREFERRED, false);
  const preferredLockRetryIntervalMs = 30_000;

  await ensureSchema();

  app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['error', 'warn'] });
  const taskRunner = app.get(TaskRunner);
  const taskService = app.get(TaskService);
  const runtimeService = app.get(RuntimeService);
  // Resolve LogWriterService so disablement is recorded in system logs. docs/en/developer/plans/stale-disable-20260305/task_plan.md stale-disable-20260305
  let logWriter: LogWriterService | null = null;
  try {
    logWriter = app.get(LogWriterService);
  } catch {
    logWriter = null;
  }

  // Detect runtimes in the worker so dependency installs can validate availability. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  try {
    await runtimeService.detectRuntimes();
  } catch (err) {
    console.warn('[worker] runtime detection failed (continuing)', err);
  }

  if (staleMs === null) {
    console.warn('[worker] stale processing recovery disabled (PROCESSING_STALE_MS is blank or 0)');
    // Emit system logs when stale recovery is intentionally disabled. docs/en/developer/plans/stale-disable-20260305/task_plan.md stale-disable-20260305
    void logWriter?.logSystem({
      level: 'info',
      message: 'Stale processing recovery disabled via PROCESSING_STALE_MS',
      code: 'TASK_STALE_RECOVERY_DISABLED',
      meta: { source: 'worker', staleMs: null }
    });
  } else {
    try {
      const recovered = await taskService.recoverStaleProcessing(staleMs);
      if (recovered > 0) {
        console.warn(`[worker] recovered ${recovered} stuck task(s) (processing timeout)`);
      }
    } catch (err) {
      console.error('[worker] recoverStaleProcessing failed', err);
    }
  }

  let stopping = false;
  const stop = (reason: string) => {
    if (stopping) return;
    stopping = true;
    console.warn(`[worker] stop requested (${reason})`);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGHUP', () => stop('SIGHUP'));

  if (preferWorker) {
    try {
      preferredLock = await tryAcquirePreferredWorkerLock();
      if (preferredLock) {
        console.log('[worker] acquired preferred worker lock (WORKER_PREFERRED=true)');
      } else {
        console.warn('[worker] WORKER_PREFERRED=true but lock is already held; continuing without preference');
      }
    } catch (err) {
      console.error('[worker] failed to acquire preferred worker lock; continuing without preference', err);
    }
  }

  const staleLabel = staleMs === null ? 'disabled' : `${staleMs}ms`;
  console.log(`[worker] started (poll=${pollIntervalMs}ms, stale=${staleLabel}, backoffOnPreferred=${backoffOnPreferred})`);

  let lastBackoffLogAt = 0;
  let lastPreferredLockRetryAt = 0;

  while (!stopping) {
    try {
      if (preferredLock?.isLost()) {
        preferredLock = null;
        console.warn('[worker] preferred worker lock lost; continuing without preference');
      }

      if (preferWorker && !preferredLock) {
        const now = Date.now();
        if (now - lastPreferredLockRetryAt >= preferredLockRetryIntervalMs) {
          lastPreferredLockRetryAt = now;
          try {
            preferredLock = await tryAcquirePreferredWorkerLock();
            if (preferredLock) {
              console.log('[worker] acquired preferred worker lock (WORKER_PREFERRED=true)');
            }
          } catch (err) {
            console.error('[worker] failed to acquire preferred worker lock; continuing without preference', err);
          }
        }
      }

      if (backoffOnPreferred && !preferredLock) {
        const preferredPresent = await isPreferredWorkerPresent();
        if (preferredPresent) {
          const now = Date.now();
          if (now - lastBackoffLogAt > 30_000) {
            console.warn('[worker] preferred worker detected; backoff (WORKER_BACKOFF_ON_PREFERRED=true)');
            lastBackoffLogAt = now;
          }
          await sleep(pollIntervalMs);
          continue;
        }
      }
      await taskRunner.trigger();
    } catch (err) {
      console.error('[worker] taskRunner.trigger failed', err);
    }
    await sleep(pollIntervalMs);
  }

  try {
    await preferredLock?.release();
  } catch (err) {
    console.error('[worker] preferred worker lock release failed', err);
  }
  await app?.close();
  await closeDb();
  console.log('[worker] stopped');
};

main().catch(async (err) => {
  console.error('[worker] fatal', err);
  try {
    try {
      await preferredLock?.release();
    } catch (_) {
      // ignore
    }
    await app?.close();
    await closeDb();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
