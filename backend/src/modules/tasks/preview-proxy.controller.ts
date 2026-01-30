import { All, Controller, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AllowQueryToken, AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { proxyHttpRequest } from '../../utils/httpProxy';
import { PreviewService } from './preview.service';

@AuthScopeGroup('tasks') // Scope preview APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('preview')
@ApiTags('Preview')
@ApiBearerAuth('bearerAuth')
// Proxy preview traffic through the API with auth enforcement. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export class PreviewProxyController {
  constructor(private readonly previewService: PreviewService) {}

  @All(':taskGroupId/:instanceName')
  @AllowQueryToken()
  @ApiOperation({
    summary: 'Proxy preview instance (root)',
    description: 'Proxy preview traffic to the task-group dev server instance.',
    operationId: 'task_groups_preview_proxy_root'
  })
  @ApiOkResponse({ description: 'OK' })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async proxyRoot(
    @Param('taskGroupId') taskGroupId: string,
    @Param('instanceName') instanceName: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    return this.forward(taskGroupId, instanceName, req, res);
  }

  @All(':taskGroupId/:instanceName/*')
  @AllowQueryToken()
  @ApiOperation({
    summary: 'Proxy preview instance',
    description: 'Proxy preview traffic to the task-group dev server instance.',
    operationId: 'task_groups_preview_proxy'
  })
  @ApiOkResponse({ description: 'OK' })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async proxy(
    @Param('taskGroupId') taskGroupId: string,
    @Param('instanceName') instanceName: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    return this.forward(taskGroupId, instanceName, req, res);
  }

  private forward(taskGroupId: string, instanceName: string, req: Request, res: Response) {
    const target = this.previewService.getProxyTarget(taskGroupId, instanceName);
    if (!target) {
      throw new NotFoundException({ error: 'Preview instance not found' });
    }
    if (target.status !== 'running' && target.status !== 'starting') {
      throw new NotFoundException({ error: 'Preview instance is not running' });
    }

    // Mark preview access to support idle timeout tracking. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.previewService.touchInstanceAccess(taskGroupId, instanceName, 'http');

    const upstreamOrigin = `http://127.0.0.1:${target.port}`;
    const prefix = `${req.baseUrl}/${taskGroupId}/${instanceName}`.replace(/\/$/, '');

    proxyHttpRequest(req, res, {
      upstreamOrigin,
      rawUrl: req.url,
      rewritePath: (pathname) => {
        const base = `/${taskGroupId}/${instanceName}`;
        if (pathname.startsWith(base)) {
          const next = pathname.slice(base.length) || '/';
          return next.startsWith('/') ? next : `/${next}`;
        }
        return pathname || '/';
      },
      rewriteHtml: (html) => this.rewritePreviewHtml(html, prefix),
      rewriteLocation: (value) => this.rewriteLocationHeader(value, prefix),
      logTag: '[preview-proxy]'
    });
  }

  private rewritePreviewHtml(html: string, prefix: string): string {
    // Ensure absolute asset paths are scoped under the preview prefix. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const safePrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const withBase = this.injectBaseHref(html, `${safePrefix}/`);
    return withBase.replace(/(href|src)=("|')\/(?!\/)/g, `$1=$2${safePrefix}/`);
  }

  private injectBaseHref(html: string, href: string): string {
    // Insert or update <base href> so relative asset URLs resolve under the preview prefix. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (/<base\s/i.test(html)) {
      return html.replace(/<base[^>]*href=("|')[^"']*("|')[^>]*>/i, `<base href="${href}" />`);
    }
    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n    <base href="${href}" />`);
  }

  private rewriteLocationHeader(value: string, prefix: string): string {
    if (value.startsWith('/')) return `${prefix}${value}`;
    return value;
  }
}
