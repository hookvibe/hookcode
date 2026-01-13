import type { Server } from 'http';
import net from 'net';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadAdminToolsConfig } from './config';
import type { AdminToolsAuthDeps } from './auth';
import { createSwaggerApp } from './swaggerApp';
import { createPrismaStudioProxyServer, spawnPrismaStudio } from './prismaStudioProxy';

const canListen = (params: { host: string; port: number }): Promise<boolean> =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (err: any) => {
      if (err?.code === 'EADDRINUSE' || err?.code === 'EACCES') return resolve(false);
      return resolve(false);
    });
    server.listen(params.port, params.host, () => {
      server.close(() => resolve(true));
    });
  });

const findFreePort = async (params: { host: string; startPort: number; maxTries: number }): Promise<number> => {
  for (let i = 0; i < params.maxTries; i += 1) {
    const port = params.startPort + i;
    // eslint-disable-next-line no-await-in-loop
    const ok = await canListen({ host: params.host, port });
    if (ok) return port;
  }
  return params.startPort;
};

const closeServer = (server: Server | null): Promise<void> =>
  new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });

const killProcess = async (proc: any): Promise<void> => {
  if (!proc) return;
  if (proc.killed) return;
  try {
    proc.kill('SIGTERM');
  } catch {
    // ignore
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (!proc.killed) {
    try {
      proc.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
};

export interface AdminToolsHandle {
  stop: () => Promise<void>;
}

export const startAdminTools = async (params: {
  authDeps: AdminToolsAuthDeps;
  nestApp?: INestApplication;
}): Promise<AdminToolsHandle | null> => {
  const cfg = loadAdminToolsConfig();
  if (!cfg.enabled) return null;

  let swaggerNestApp: INestApplication | null = params.nestApp ?? null;
  let shouldCloseSwaggerNestApp = false;
  if (!swaggerNestApp) {
    swaggerNestApp = await NestFactory.create(AppModule, {
      logger: false
    });
    shouldCloseSwaggerNestApp = true;
  }

  const upstreamHost = '127.0.0.1';
  const resolvedUpstreamPort = await findFreePort({
    host: upstreamHost,
    startPort: cfg.prismaUpstreamPort,
    maxTries: 50
  });
  if (resolvedUpstreamPort !== cfg.prismaUpstreamPort) {
    console.warn(
      `[admin-tools] prisma upstream port ${cfg.prismaUpstreamPort} is in use; switched to ${resolvedUpstreamPort}`
    );
  }

  const swaggerApp = createSwaggerApp({
    apiBaseUrl: cfg.apiBaseUrl,
    cookieSecure: cfg.cookieSecure,
    authDeps: params.authDeps,
    nestApp: swaggerNestApp
  });

  const swaggerServer = swaggerApp.listen(cfg.swaggerPort, cfg.host, () => {
    console.log(`[admin-tools] swagger listening on http://${cfg.host}:${cfg.swaggerPort}`);
  });

  const prismaChild = await spawnPrismaStudio({ upstreamPort: resolvedUpstreamPort, hostname: upstreamHost });

  const prismaServer = createPrismaStudioProxyServer({
    upstreamPort: resolvedUpstreamPort,
    cookieSecure: cfg.cookieSecure,
    authDeps: params.authDeps
  });
  prismaServer.listen(cfg.prismaPort, cfg.host, () => {
    console.log(`[admin-tools] prisma studio (proxy) listening on http://${cfg.host}:${cfg.prismaPort}`);
  });

  return {
    stop: async () => {
      await closeServer(prismaServer);
      await closeServer(swaggerServer);
      await killProcess(prismaChild);
      if (shouldCloseSwaggerNestApp) {
        try {
          await swaggerNestApp?.close();
        } catch {
          // ignore
        }
      }
    }
  };
};
