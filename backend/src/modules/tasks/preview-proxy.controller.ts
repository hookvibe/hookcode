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

    // Persist preview token for iframe asset requests that cannot send auth headers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const token = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    if (token) {
      res.setHeader('set-cookie', `hookcode-preview-token=${encodeURIComponent(token)}; Path=/api/preview; SameSite=Lax; HttpOnly`);
    }

    const upstreamOrigin = `http://127.0.0.1:${target.port}`;
    const prefix = this.resolvePreviewPrefix(req, taskGroupId, instanceName);

    proxyHttpRequest(req, res, {
      upstreamOrigin,
      rawUrl: req.url,
      rewritePath: (pathname) => this.stripPreviewPrefix(pathname, prefix, taskGroupId, instanceName),
      rewriteHtml: (html) => this.rewritePreviewHtml(html, prefix),
      rewriteText: (text) => this.rewritePreviewText(text, prefix),
      rewriteLocation: (value) => this.rewriteLocationHeader(value, prefix),
      logTag: '[preview-proxy]'
    });
  }

  private rewritePreviewHtml(html: string, prefix: string): string {
    // Ensure absolute asset paths are scoped under the preview prefix. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const safePrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const withBase = this.injectBaseHref(html, `${safePrefix}/`);
    const normalizedPrefix = safePrefix.startsWith('/') ? safePrefix.slice(1) : safePrefix;
    const escapedPrefix = normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attrRegex = new RegExp(`(href|src)=(\"|')/(?!/|${escapedPrefix}/)`, 'g');
    const withAttrs = withBase.replace(attrRegex, `$1=$2${safePrefix}/`);
    return this.rewritePreviewText(withAttrs, prefix);
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

  private rewritePreviewText(text: string, prefix: string): string {
    // Rewrite absolute module/asset paths inside JS/CSS or inline scripts to include the preview prefix. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const safePrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const normalizedPrefix = safePrefix.startsWith('/') ? safePrefix.slice(1) : safePrefix;
    const escapedPrefix = normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const absolutePathRegex = new RegExp(`(["'])/(?!/|${escapedPrefix}/)`, 'g');
    let rewritten = text.replace(absolutePathRegex, `$1${safePrefix}/`);
    rewritten = rewritten.replace(new RegExp(`url\\(\\s*/(?!/|${escapedPrefix}/)`, 'g'), `url(${safePrefix}/`);
    return rewritten;
  }

  private stripPreviewPrefix(pathname: string, prefix: string, taskGroupId: string, instanceName: string): string {
    // Strip the preview prefix (including /api) so upstream sees the correct dev-server path. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    if (pathname.startsWith(normalizedPrefix)) {
      const next = pathname.slice(normalizedPrefix.length) || '/';
      return next.startsWith('/') ? next : `/${next}`;
    }
    const base = `/${taskGroupId}/${instanceName}`;
    if (pathname.startsWith(base)) {
      const next = pathname.slice(base.length) || '/';
      return next.startsWith('/') ? next : `/${next}`;
    }
    return pathname || '/';
  }

  private resolvePreviewPrefix(req: Request, taskGroupId: string, instanceName: string): string {
    // Derive the preview prefix from the full request path to avoid double-prefixing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const raw = req.originalUrl ?? req.url ?? '';
    const pathname = new URL(raw, 'http://local').pathname;
    const marker = `/${taskGroupId}/${instanceName}`;
    const idx = pathname.indexOf(marker);
    if (idx >= 0) {
      return pathname.slice(0, idx + marker.length).replace(/\/$/, '');
    }
    return `/preview/${taskGroupId}/${instanceName}`;
  }
}
