import 'reflect-metadata';

import dotenv from 'dotenv';
import express from 'express';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import type { DynamicModule, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { verifyToken } from './auth/authService';
import { closeDb, ensureSchema } from './db';
import { isTruthy } from './utils/env';
import { isAdminToolsEmbeddedEnabled } from './adminTools/config';
import { startAdminTools, type AdminToolsHandle } from './adminTools/startAdminTools';
import { TaskService } from './modules/tasks/task.service';
import { UserService } from './modules/users/user.service';
import { RuntimeService } from './services/runtimeService';

dotenv.config();

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

const buildAllowedOrigins = (): { allowAll: boolean; origins: Set<string> } => {
  const raw = (process.env.ALLOWED_ORIGIN ?? '').trim();
  const allowAll = !raw || raw === '*';
  const origins = new Set<string>();

  if (!allowAll) {
    raw
      .split(',')
      .map((v) => normalizeOrigin(v))
      .filter(Boolean)
      .forEach((v) => origins.add(v));
  }

  // If Admin Tools (Swagger) is enabled, automatically allow common local origins to avoid Swagger "Try it out" failures.
  if (isTruthy(process.env.ADMIN_TOOLS_ENABLED, false)) {
    const swaggerPort = Number(process.env.ADMIN_TOOLS_SWAGGER_PORT ?? 7216);
    if (Number.isFinite(swaggerPort) && swaggerPort > 0) {
      origins.add(`http://localhost:${swaggerPort}`);
      origins.add(`http://127.0.0.1:${swaggerPort}`);
    }
  }

  return { allowAll, origins };
};

const toNumber = (value: string | undefined, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

export type NestRootModule = Type<unknown> | DynamicModule;

export interface BootstrapOptions {
  rootModule: NestRootModule;
  host?: string;
  port?: number;
  globalPrefix?: string;
  globalPrefixExclude?: Array<string | { path: string; method: RequestMethod }>;
  /**
   * Used for server logs, e.g. "[backend]" or "[custom-backend]".
   */
  logTag?: string;
}

export interface BootstrapHandle {
  app: NestExpressApplication;
  adminTools: AdminToolsHandle | null;
  stop: () => Promise<void>;
}

export const bootstrapHttpServer = async (options: BootstrapOptions): Promise<BootstrapHandle> => {
  const port = options.port ?? (Number(process.env.PORT) || 4000);
  const host = options.host ?? (process.env.HOST || '127.0.0.1');
  const logTag = options.logTag ?? '[backend]';
  const globalPrefix = options.globalPrefix ?? 'api';

  let adminTools: AdminToolsHandle | null = null;
  let staleReaperTimer: NodeJS.Timeout | null = null;

  await ensureSchema();

  const app = await NestFactory.create<NestExpressApplication>(options.rootModule as any, {
    bodyParser: false,
    logger: ['debug','error', 'warn','log','verbose']
  });

  const allowedOrigins = buildAllowedOrigins();
  app.enableCors({
    origin: allowedOrigins.allowAll
      ? true
      : (origin, callback) => {
          if (!origin) return callback(null, true);
          callback(null, allowedOrigins.origins.has(normalizeOrigin(origin)));
        },
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  // Custom JSON parser:
  // - Keep raw body for GitHub signature verification (X-Hub-Signature-256).
  app.use(
    express.json({
      limit: '1mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  app.setGlobalPrefix(globalPrefix, options.globalPrefixExclude ? { exclude: options.globalPrefixExclude } : undefined);
  await app.init();

  const runtimeService = app.get(RuntimeService);
  try {
    // Detect available runtimes once on startup for dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const runtimes = await runtimeService.detectRuntimes();
    console.log(`${logTag} detected runtimes`, runtimes.map((rt) => `${rt.language}@${rt.version}`));
  } catch (err) {
    console.warn(`${logTag} runtime detection failed`, err);
  }

  const userService = app.get(UserService);
  await userService.ensureBootstrapUser();

  const taskService = app.get(TaskService);

  // Recover "stuck" processing tasks periodically.
  const staleMs = toNumber(process.env.PROCESSING_STALE_MS, 30 * 60 * 1000);
  const intervalMs = Math.max(5_000, toNumber(process.env.PROCESSING_STALE_RECOVERY_INTERVAL_MS, 60_000));
  try {
    const recovered = await taskService.recoverStaleProcessing(staleMs);
    if (recovered > 0) {
      console.warn(`${logTag} recovered ${recovered} stuck task(s) (processing timeout)`);
    }
  } catch (err) {
    console.error(`${logTag} recoverStaleProcessing failed`, err);
  }
  staleReaperTimer = setInterval(async () => {
    try {
      const recovered = await taskService.recoverStaleProcessing(staleMs);
      if (recovered > 0) {
        console.warn(`${logTag} recovered ${recovered} stuck task(s) (processing timeout)`);
      }
    } catch (err) {
      console.error(`${logTag} recoverStaleProcessing failed`, err);
    }
  }, intervalMs);

  await app.listen(port, host);
  console.log(`${logTag} listening on http://${host}:${port}`);

  const adminToolsEmbedded = isAdminToolsEmbeddedEnabled();
  if (adminToolsEmbedded) {
    adminTools = await startAdminTools({
      authDeps: { verifyToken, getUserById: userService.getById.bind(userService) },
      nestApp: app
    });
  }

  const stop = async () => {
    if (staleReaperTimer) clearInterval(staleReaperTimer);
    try {
      await adminTools?.stop();
    } catch (err) {
      console.error(`${logTag} stop admin tools faile`, err);
    }
    await app.close();
    await closeDb();
  };

  return { app, adminTools, stop };
};
