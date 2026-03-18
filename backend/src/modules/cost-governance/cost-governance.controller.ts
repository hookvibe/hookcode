import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UsageAggregationService } from '../../costGovernance/usageAggregation.service';
import { db } from '../../db';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { RepoAccessService } from '../repositories/repo-access.service';
import { CostBreakdownResponseDto, CostSummaryResponseDto } from './dto/cost-governance-swagger.dto';

const normalizeScope = (value: unknown): 'me' | 'repo' | 'global' => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'repo') return 'repo';
  if (raw === 'global') return 'global';
  return 'me';
};

const parseDays = (value: unknown, fallback: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const normalized = Math.floor(num);
  return Math.max(1, Math.min(365, normalized));
};

@AuthScopeGroup('tasks')
@Controller('costs')
@ApiTags('Costs')
@ApiBearerAuth('bearerAuth')
export class CostGovernanceController {
  constructor(
    private readonly usageAggregationService: UsageAggregationService,
    private readonly repoAccessService: RepoAccessService
  ) {}

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
  }

  private requireAdmin(req: Request) {
    this.requireUser(req);
    if (!this.repoAccessService.isAdmin(req.user)) {
      throw new ForbiddenException({ error: 'Forbidden', code: 'ADMIN_REQUIRED' });
    }
  }

  private async requireRobotRepoRead(req: Request, robotId: string): Promise<string> {
    const row = await db.repoRobot.findUnique({
      where: { id: robotId },
      select: { repoId: true }
    });
    if (!row?.repoId) throw new BadRequestException({ error: 'Robot not found' });
    await this.repoAccessService.requireRepoRead(req.user!, String(row.repoId));
    return String(row.repoId);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get cost summary',
    description: 'Return cost, token, provider, repo, robot, and quota-event summaries.',
    operationId: 'costs_summary'
  })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'scope', required: false, description: 'me | repo | global' })
  @ApiQuery({ name: 'repoId', required: false })
  @ApiQuery({ name: 'robotId', required: false })
  @ApiOkResponse({ type: CostSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async summary(
    @Req() req: Request,
    @Query('days') daysRaw: string | undefined,
    @Query('scope') scopeRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined
  ) {
    try {
      this.requireUser(req);
      const days = parseDays(daysRaw, 30);
      const scope = normalizeScope(scopeRaw);
      const repoId = typeof repoIdRaw === 'string' && repoIdRaw.trim() ? repoIdRaw.trim() : undefined;
      const robotId = typeof robotIdRaw === 'string' && robotIdRaw.trim() ? robotIdRaw.trim() : undefined;

      if (scope === 'global') this.requireAdmin(req);
      if (scope === 'repo' && !repoId && !robotId) {
        throw new BadRequestException({ error: 'repoId or robotId is required for repo scope' });
      }

      if (repoId) await this.repoAccessService.requireRepoRead(req.user!, repoId);
      const resolvedRepoId = robotId ? await this.requireRobotRepoRead(req, robotId) : repoId;

      return this.usageAggregationService.getCostSummary({
        days,
        repoId: scope === 'repo' ? resolvedRepoId : repoId,
        robotId: scope === 'repo' ? robotId : undefined,
        actorUserId: scope === 'me' ? req.user!.id : undefined,
        allowedRepoIds: scope === 'global' ? null : undefined
      });
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      console.error('[costs] summary failed', err);
      throw new InternalServerErrorException({ error: 'Failed to load cost summary' });
    }
  }

  @Get('by-repo')
  @ApiOperation({
    summary: 'Get repo cost breakdown',
    description: 'Return cost breakdown grouped by repository.',
    operationId: 'costs_by_repo'
  })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'scope', required: false, description: 'me | global' })
  @ApiOkResponse({ type: CostBreakdownResponseDto })
  async byRepo(
    @Req() req: Request,
    @Query('days') daysRaw: string | undefined,
    @Query('scope') scopeRaw: string | undefined
  ) {
    try {
      this.requireUser(req);
      const days = parseDays(daysRaw, 30);
      const scope = normalizeScope(scopeRaw);
      if (scope === 'repo') throw new BadRequestException({ error: 'repo scope is not supported for by-repo' });
      if (scope === 'global') this.requireAdmin(req);

      return this.usageAggregationService.getRepoBreakdown({
        days,
        actorUserId: scope === 'me' ? req.user!.id : undefined,
        allowedRepoIds: scope === 'global' ? null : undefined
      });
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      console.error('[costs] by-repo failed', err);
      throw new InternalServerErrorException({ error: 'Failed to load repo cost breakdown' });
    }
  }

  @Get('by-robot')
  @ApiOperation({
    summary: 'Get robot cost breakdown',
    description: 'Return cost breakdown grouped by robot.',
    operationId: 'costs_by_robot'
  })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'scope', required: false, description: 'me | repo | global' })
  @ApiQuery({ name: 'repoId', required: false })
  @ApiOkResponse({ type: CostBreakdownResponseDto })
  async byRobot(
    @Req() req: Request,
    @Query('days') daysRaw: string | undefined,
    @Query('scope') scopeRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined
  ) {
    try {
      this.requireUser(req);
      const days = parseDays(daysRaw, 30);
      const scope = normalizeScope(scopeRaw);
      const repoId = typeof repoIdRaw === 'string' && repoIdRaw.trim() ? repoIdRaw.trim() : undefined;
      if (scope === 'repo' && !repoId) throw new BadRequestException({ error: 'repoId is required for repo scope' });
      if (scope === 'global') this.requireAdmin(req);
      if (repoId) await this.repoAccessService.requireRepoRead(req.user!, repoId);

      return this.usageAggregationService.getRobotBreakdown({
        days,
        repoId: scope === 'repo' ? repoId : repoId,
        actorUserId: scope === 'me' ? req.user!.id : undefined,
        allowedRepoIds: scope === 'global' ? null : undefined
      });
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      console.error('[costs] by-robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to load robot cost breakdown' });
    }
  }
}
