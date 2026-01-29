import http, { type IncomingMessage } from 'http';
import net from 'net';
import type { Duplex } from 'stream';
import type { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { isAuthEnabled, verifyToken } from '../../auth/authService';
import { extractAuthToken } from '../auth/authToken';
import { AuthUserLoader } from '../auth/auth-user-loader';
import { PreviewService } from './preview.service';

interface PreviewWsRouteMatch {
  taskGroupId: string;
  instanceName: string;
  upstreamPath: string;
}

@Injectable()
export class PreviewWsProxyService {
  constructor(
    private readonly previewService: PreviewService,
    private readonly authUserLoader: AuthUserLoader
  ) {}

  attach(server: http.Server): void {
    // Attach a single upgrade handler for preview WS/HMR proxying. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    server.on('upgrade', (req, socket, head) => {
      void this.handleUpgrade(req, socket, head);
    });
  }

  private async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const match = this.matchPreviewRoute(req);
    if (!match) return;

    const authorized = await this.authenticate(req);
    if (!authorized) {
      this.writeSocketResponse(socket, 401, 'Unauthorized');
      return;
    }

    const target = this.previewService.getProxyTarget(match.taskGroupId, match.instanceName);
    if (!target || (target.status !== 'running' && target.status !== 'starting')) {
      this.writeSocketResponse(socket, 404, 'Preview instance not running');
      return;
    }

    // Track WS/HMR access for idle timeout purposes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.previewService.touchInstanceAccess(match.taskGroupId, match.instanceName, 'ws');

    const upstreamSocket = net.connect(target.port, '127.0.0.1', () => {
      const requestLines = this.buildUpgradeRequestLines(req, match.upstreamPath, target.port);
      upstreamSocket.write(requestLines);
      if (head && head.length > 0) upstreamSocket.write(head);
      socket.pipe(upstreamSocket).pipe(socket);
    });

    upstreamSocket.on('error', () => {
      socket.destroy();
    });

    // Close upstream when the client socket errors to avoid leaks. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    socket.on('error', () => {
      upstreamSocket.destroy();
    });
  }

  private matchPreviewRoute(req: IncomingMessage): PreviewWsRouteMatch | null {
    const rawUrl = req.url ?? '/';
    const parsed = new URL(rawUrl, 'http://local');
    const pathname = parsed.pathname ?? '/';
    const previewIndex = pathname.indexOf('/preview/');
    if (previewIndex < 0) return null;

    const suffix = pathname.slice(previewIndex + '/preview/'.length);
    const parts = suffix.split('/');
    const taskGroupId = (parts.shift() ?? '').trim();
    const instanceName = (parts.shift() ?? '').trim();
    if (!taskGroupId || !instanceName) return null;

    const rest = parts.join('/');
    const upstreamPath = `${rest ? `/${rest}` : '/'}${parsed.search ?? ''}`;

    return { taskGroupId, instanceName, upstreamPath };
  }

  private async authenticate(req: IncomingMessage): Promise<boolean> {
    // Enforce the same auth rules as the HTTP preview proxy for WS upgrades. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!isAuthEnabled()) return true;

    const parsed = new URL(req.url ?? '/', 'http://local');
    const fakeReq = {
      header: (name: string) => {
        const v = (req.headers as any)[name.toLowerCase()];
        return Array.isArray(v) ? v.join(',') : v;
      },
      query: Object.fromEntries(parsed.searchParams.entries())
    } as Request;

    const token = extractAuthToken(fakeReq, { allowQueryToken: true });
    if (!token) return false;

    let payload: { sub: string; iat: number; exp: number };
    try {
      payload = verifyToken(token);
    } catch {
      return false;
    }

    const user = await this.authUserLoader.loadUser(payload.sub);
    return Boolean(user);
  }

  private buildUpgradeRequestLines(req: IncomingMessage, upstreamPath: string, upstreamPort: number): string {
    // Rewrite the upgrade request line + host header for the upstream dev server. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const lines: string[] = [];
    lines.push(`${req.method ?? 'GET'} ${upstreamPath} HTTP/${req.httpVersion}`);

    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (key.toLowerCase() === 'host') continue;
      if (Array.isArray(value)) {
        for (const v of value) lines.push(`${key}: ${v}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }

    lines.push(`host: 127.0.0.1:${upstreamPort}`);
    lines.push('\r\n');
    return lines.join('\r\n');
  }

  private writeSocketResponse(socket: Duplex, status: number, message: string): void {
    try {
      socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    } finally {
      socket.destroy();
    }
  }
}
