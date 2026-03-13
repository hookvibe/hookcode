import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Patch,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { db } from '../../db';
import { PolicyEngineService, type PolicyRuleUpsertInput } from '../../policyEngine/policyEngine.service';
import { normalizeString } from '../../utils/parse';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { RepoAccessService } from '../repositories/repo-access.service';
import {
  ListPoliciesResponseDto,
  PatchPoliciesRequestDto
} from './dto/approvals-swagger.dto';

@AuthScopeGroup('tasks')
@Controller('policies')
@ApiTags('Policies')
@ApiBearerAuth('bearerAuth')
export class PoliciesController {
  constructor(
    private readonly policyEngine: PolicyEngineService,
    private readonly repoAccessService: RepoAccessService
  ) {}

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
  }

  private async listManageableRepoIds(user: { id: string; roles?: string[] }): Promise<string[] | null> {
    if (this.repoAccessService.isAdmin(user)) return null;
    const rows = await db.repoMember.findMany({
      where: { userId: user.id, role: { in: ['owner', 'maintainer'] } },
      select: { repoId: true }
    });
    return rows.map((row) => String(row.repoId));
  }

  @Get()
  @ApiOperation({
    summary: 'List policy rules',
    description: 'List policy rules visible to the current user.',
    operationId: 'policies_list'
  })
  @ApiQuery({ name: 'repoId', required: false })
  @ApiQuery({ name: 'robotId', required: false })
  @ApiOkResponse({ description: 'OK', type: ListPoliciesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(@Req() req: Request, @Query('repoId') repoIdRaw: string | undefined, @Query('robotId') robotIdRaw: string | undefined) {
    try {
      this.requireUser(req);
      const repoId = normalizeString(repoIdRaw) || undefined;
      const robotId = normalizeString(robotIdRaw) || undefined;

      if (repoId) {
        await this.repoAccessService.requireRepoManage(req.user!, repoId);
        return { rules: await this.policyEngine.listPolicyRules({ repoId, robotId }) };
      }

      const rules = await this.policyEngine.listPolicyRules({ robotId });
      if (this.repoAccessService.isAdmin(req.user!)) return { rules };

      const allowedRepoIds = await this.listManageableRepoIds(req.user!);
      return { rules: rules.filter((rule) => rule.repoId && allowedRepoIds?.includes(rule.repoId)) };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[policies] list failed', err);
      throw new InternalServerErrorException({ error: 'Failed to list policies' });
    }
  }

  @Patch()
  @ApiOperation({
    summary: 'Upsert policy rules',
    description: 'Create or update repo/robot scoped policy rules.',
    operationId: 'policies_patch'
  })
  @ApiOkResponse({ description: 'OK', type: ListPoliciesResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  async patch(@Req() req: Request, @Body() body: PatchPoliciesRequestDto) {
    try {
      this.requireUser(req);
      const rules = Array.isArray(body?.rules) ? body.rules : [];
      if (!rules.length) return { rules: [] };

      const isAdmin = this.repoAccessService.isAdmin(req.user!);
      const inputs: PolicyRuleUpsertInput[] = [];

      for (const rule of rules) {
        const repoId = normalizeString(rule?.repoId) || undefined;
        const robotId = normalizeString(rule?.robotId) || undefined;
        if (repoId) {
          await this.repoAccessService.requireRepoManage(req.user!, repoId);
        } else if (!isAdmin) {
          throw new UnauthorizedException({ error: 'Admin access is required for global policy rules' });
        }

        inputs.push({
          id: normalizeString(rule?.id) || undefined,
          repoId,
          robotId,
          name: normalizeString(rule?.name) || 'Policy rule',
          enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : true,
          priority: typeof rule?.priority === 'number' ? rule.priority : undefined,
          action: rule?.action ?? 'allow',
          conditions: rule?.conditions,
          actorUserId: req.user!.id
        });
      }

      const upserted = await this.policyEngine.upsertPolicyRules(inputs);
      return { rules: upserted };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[policies] patch failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update policies' });
    }
  }
}
