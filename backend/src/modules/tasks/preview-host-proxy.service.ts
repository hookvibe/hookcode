import { Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { proxyHttpRequest } from '../../utils/httpProxy';
import { isRequestHttps, resolvePreviewHostMatch } from '../../utils/previewHost';
import { AuthUserLoader } from '../auth/auth-user-loader';
import { authenticatePreviewRequest } from './preview-auth';
import { PreviewService } from './preview.service';

@Injectable()
export class PreviewHostProxyService {
  constructor(
    private readonly previewService: PreviewService,
    private readonly authUserLoader: AuthUserLoader
  ) {}

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const hostMatch = resolvePreviewHostMatch(req.headers.host);
    if (!hostMatch) {
      next();
      return;
    }

    // Enforce preview auth before proxying subdomain traffic. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const authorized = await authenticatePreviewRequest(req, this.authUserLoader);
    if (!authorized) {
      res.status(401).type('text/plain; charset=utf-8').send('Unauthorized');
      return;
    }

    const target = this.previewService.getProxyTarget(hostMatch.taskGroupId, hostMatch.instanceName);
    if (!target || (target.status !== 'running' && target.status !== 'starting')) {
      res.status(404).type('text/plain; charset=utf-8').send('Preview instance not running');
      return;
    }

    // Track subdomain preview access for idle timeout checks. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.previewService.touchInstanceAccess(hostMatch.taskGroupId, hostMatch.instanceName, 'http');

    const token = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    if (token) {
      this.setPreviewCookie(req, res, token);
    }

    proxyHttpRequest(req, res, {
      upstreamOrigin: `http://127.0.0.1:${target.port}`,
      rawUrl: req.originalUrl ?? req.url ?? '/',
      logTag: '[preview-host-proxy]'
    });
  }

  private setPreviewCookie(req: Request, res: Response, token: string): void {
    // Persist preview auth tokens for subdomain asset requests. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const parts = [`hookcode-preview-token=${encodeURIComponent(token)}`, 'Path=/', 'SameSite=Lax', 'HttpOnly'];
    if (isRequestHttps(req)) parts.push('Secure');
    res.setHeader('set-cookie', parts.join('; '));
  }
}
