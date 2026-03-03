import { Controller, ForbiddenException, Get, InternalServerErrorException, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LogWriterService } from '../logs/log-writer.service';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { RepoAccessService } from '../repositories/repo-access.service';
import { PreviewService } from './preview.service';
import { PreviewAdminOverviewResponseDto } from './dto/preview-admin.dto';

@AuthScopeGroup('system') // Scope preview admin APIs under system-level PAT permissions. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
@Controller('preview-admin')
@ApiTags('Preview Admin')
@ApiBearerAuth('bearerAuth')
export class PreviewAdminController {
  constructor(
    private readonly previewService: PreviewService,
    private readonly repoAccessService: RepoAccessService,
    private readonly logWriter: LogWriterService
  ) {}

  private requireAdmin(req: Request): { id: string; roles?: string[] } {
    // Enforce admin-only access before exposing global preview runtime and port allocation data. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (!this.repoAccessService.isAdmin(req.user)) {
      throw new ForbiddenException({ error: 'Forbidden', code: 'ADMIN_REQUIRED' });
    }
    return req.user;
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get preview admin overview',
    description: 'List active preview task groups and preview port allocation for admin management.',
    operationId: 'preview_admin_overview'
  })
  @ApiOkResponse({ description: 'OK', type: PreviewAdminOverviewResponseDto })
  async getOverview(@Req() req: Request): Promise<PreviewAdminOverviewResponseDto> {
    const user = this.requireAdmin(req);
    try {
      const overview = await this.previewService.getPreviewAdminOverview();
      // Emit an audit log entry for preview management visibility operations. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Preview admin overview requested',
        code: 'PREVIEW_ADMIN_OVERVIEW_REQUESTED',
        actorUserId: user.id,
        meta: {
          activeTaskGroups: overview.activeTaskGroups.length,
          inUsePorts: overview.portAllocation.inUseCount
        }
      });
      return overview;
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
      console.error('[preview-admin] overview failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch preview admin overview' });
    }
  }
}
