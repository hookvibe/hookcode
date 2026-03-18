import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Patch,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { db } from '../../db';
import { BudgetService } from '../../costGovernance/budget.service';
import { normalizeBudgetScopeType, type BudgetScopeType } from '../../costGovernance/types';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { RepoAccessService } from '../repositories/repo-access.service';
import { BudgetPoliciesResponseDto, BudgetPolicyDto, BudgetPolicyResponseDto } from './dto/cost-governance-swagger.dto';

type BudgetPatchBody = Partial<BudgetPolicyDto> & { scopeType?: BudgetScopeType; scopeId?: string };

@AuthScopeGroup('tasks')
@Controller('budgets')
@ApiTags('Budgets')
@ApiBearerAuth('bearerAuth')
export class BudgetsController {
  constructor(
    private readonly budgetService: BudgetService,
    private readonly repoAccessService: RepoAccessService
  ) {}

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
  }

  private async resolveScope(req: Request, scopeTypeRaw: unknown, scopeIdRaw: unknown): Promise<{ scopeType: BudgetScopeType; scopeId: string }> {
    this.requireUser(req);
    const scopeType = normalizeBudgetScopeType(scopeTypeRaw) ?? 'user';
    const scopeId = typeof scopeIdRaw === 'string' && scopeIdRaw.trim() ? scopeIdRaw.trim() : req.user!.id;

    if (scopeType === 'user') {
      if (scopeId !== req.user!.id && !this.repoAccessService.isAdmin(req.user)) {
        throw new ForbiddenException({ error: 'Forbidden', code: 'ADMIN_REQUIRED' });
      }
      return { scopeType, scopeId };
    }

    if (scopeType === 'repo') {
      if (!scopeId) throw new BadRequestException({ error: 'scopeId is required for repo budgets' });
      await this.repoAccessService.requireRepoManage(req.user!, scopeId);
      return { scopeType, scopeId };
    }

    if (!scopeId) throw new BadRequestException({ error: 'scopeId is required for robot budgets' });
    const robot = await db.repoRobot.findUnique({ where: { id: scopeId }, select: { repoId: true } });
    if (!robot?.repoId) throw new BadRequestException({ error: 'Robot not found' });
    await this.repoAccessService.requireRepoManage(req.user!, String(robot.repoId));
    return { scopeType, scopeId };
  }

  @Get()
  @ApiOperation({
    summary: 'Get budget policies',
    description: 'Return the budget policy for a user/repo/robot scope.',
    operationId: 'budgets_get'
  })
  @ApiQuery({ name: 'scopeType', required: false, description: 'user | repo | robot' })
  @ApiQuery({ name: 'scopeId', required: false })
  @ApiOkResponse({ type: BudgetPoliciesResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async getPolicies(
    @Req() req: Request,
    @Query('scopeType') scopeTypeRaw: string | undefined,
    @Query('scopeId') scopeIdRaw: string | undefined
  ) {
    try {
      const { scopeType, scopeId } = await this.resolveScope(req, scopeTypeRaw, scopeIdRaw);
      const policy = await this.budgetService.getPolicy(scopeType, scopeId);
      return { policies: policy ? [policy] : [] };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      console.error('[budgets] get failed', err);
      throw new InternalServerErrorException({ error: 'Failed to load budget policy' });
    }
  }

  @Patch()
  @ApiOperation({
    summary: 'Create or update budget policy',
    description: 'Upsert a budget policy for a user/repo/robot scope.',
    operationId: 'budgets_patch'
  })
  @ApiBody({ type: BudgetPolicyDto })
  @ApiOkResponse({ type: BudgetPolicyResponseDto })
  async patchPolicy(@Req() req: Request, @Body() body: BudgetPatchBody) {
    try {
      const { scopeType, scopeId } = await this.resolveScope(req, body?.scopeType, body?.scopeId);
      const policy = await this.budgetService.upsertPolicy({
        scopeType,
        scopeId,
        actorUserId: req.user!.id,
        name: body?.name ?? null,
        enabled: body?.enabled,
        overageAction: body?.overageAction,
        dailyTaskCountLimit: body?.dailyTaskCountLimit ?? null,
        monthlyTaskCountLimit: body?.monthlyTaskCountLimit ?? null,
        dailyTokenLimit: body?.dailyTokenLimit ?? null,
        monthlyTokenLimit: body?.monthlyTokenLimit ?? null,
        dailyEstimatedCostUsdLimit: body?.dailyEstimatedCostUsdLimit ?? null,
        monthlyEstimatedCostUsdLimit: body?.monthlyEstimatedCostUsdLimit ?? null,
        maxRuntimeSeconds: body?.maxRuntimeSeconds ?? null,
        maxStepCount: body?.maxStepCount ?? null,
        degradeProvider: body?.degradeProvider ?? null,
        degradeModel: body?.degradeModel ?? null,
        forceReadOnlyOnOverage: body?.forceReadOnlyOnOverage
      });
      return { policy };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      console.error('[budgets] patch failed', err);
      throw new InternalServerErrorException({ error: 'Failed to save budget policy' });
    }
  }
}
