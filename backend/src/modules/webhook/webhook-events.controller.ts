import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpException, InternalServerErrorException, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { isAuthEnabled } from '../../auth/authService';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { RepoAccessService } from '../repositories/repo-access.service';
import { parsePositiveInt } from '../../utils/parse';
import { ReplayWebhookEventDto } from './dto/replay-webhook-event.dto';
import { GetWebhookEventResponseDto, ListWebhookEventsResponseDto, ReplayWebhookEventResponseDto } from './dto/webhook-events-swagger.dto';
import { WebhookEventsService } from './webhook-events.service';

const normalizeResult = (value: unknown): 'accepted' | 'skipped' | 'rejected' | 'error' | undefined => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'accepted' || raw === 'skipped' || raw === 'rejected' || raw === 'error') return raw;
  return undefined;
};

const normalizeProvider = (value: unknown): 'gitlab' | 'github' | undefined => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'gitlab' || raw === 'github') return raw;
  return undefined;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw : undefined;
};

// Expose admin/global webhook event APIs while still allowing repo members to open detail and replay known event ids. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
@AuthScopeGroup('system')
@Controller('webhooks/events')
@ApiTags('Webhook')
@ApiBearerAuth('bearerAuth')
export class WebhookEventsController {
  constructor(
    private readonly webhookEventsService: WebhookEventsService,
    private readonly repoAccessService: RepoAccessService
  ) {}

  private requireUser(req: Request) {
    if (req.user) return req.user;
    if (!isAuthEnabled()) {
      return { id: 'system', username: 'system', roles: ['admin'] };
    }
    throw new UnauthorizedException({ error: 'Unauthorized' });
  }

  @Get()
  @ApiOperation({
    summary: 'List webhook events',
    description: 'List webhook events for the global replay/debug center (admin only).',
    operationId: 'webhook_events_list'
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'repoId', required: false })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'result', required: false })
  @ApiQuery({ name: 'errorLayer', required: false })
  @ApiQuery({ name: 'replayOfEventId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({ description: 'OK', type: ListWebhookEventsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Req() req: Request,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('provider') providerRaw: string | undefined,
    @Query('result') resultRaw: string | undefined,
    @Query('errorLayer') errorLayerRaw: string | undefined,
    @Query('replayOfEventId') replayOfEventIdRaw: string | undefined,
    @Query('q') queryRaw: string | undefined
  ) {
    const user = this.requireUser(req);
    if (!this.repoAccessService.isAdmin(user)) {
      throw new ForbiddenException({ error: 'Forbidden', code: 'ADMIN_REQUIRED' });
    }

    const result = normalizeResult(resultRaw);
    if (resultRaw && !result) throw new BadRequestException({ error: 'Invalid result' });
    const provider = normalizeProvider(providerRaw);
    if (providerRaw && !provider) throw new BadRequestException({ error: 'Invalid provider' });

    return this.webhookEventsService.listGlobalEvents({
      limit: parsePositiveInt(limitRaw, 50),
      cursor: normalizeOptionalString(cursorRaw),
      repoId: normalizeOptionalString(repoIdRaw),
      provider,
      result,
      errorLayer: normalizeOptionalString(errorLayerRaw) as any,
      replayOfEventId: normalizeOptionalString(replayOfEventIdRaw),
      query: normalizeOptionalString(queryRaw)
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get webhook event',
    description: 'Get a webhook event detail by id.',
    operationId: 'webhook_events_get'
  })
  @ApiOkResponse({ description: 'OK', type: GetWebhookEventResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async get(@Req() req: Request, @Param('id') id: string) {
    const user = this.requireUser(req);
    const event = await this.webhookEventsService.getEvent(String(id ?? '').trim());
    if (!this.repoAccessService.isAdmin(user)) {
      await this.repoAccessService.requireRepoRead(user, event.repoId);
    }
    return { event };
  }

  @Post(':id/replay')
  @ApiOperation({
    summary: 'Replay webhook event',
    description: 'Replay a historical webhook event into real tasks.',
    operationId: 'webhook_events_replay'
  })
  @ApiBody({ type: ReplayWebhookEventDto })
  @ApiOkResponse({ description: 'OK', type: ReplayWebhookEventResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  async replay(@Req() req: Request, @Param('id') id: string, @Body() body: ReplayWebhookEventDto) {
    try {
      const user = this.requireUser(req);
      const event = await this.webhookEventsService.getEvent(String(id ?? '').trim());
      if (!this.repoAccessService.isAdmin(user)) {
        await this.repoAccessService.requireRepoManage(user, event.repoId);
      }
      const replayed = await this.webhookEventsService.replayEvent(event.id, user.id, body, { dryRun: false });
      return { event: replayed };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[webhooks] replay failed', err);
      throw new InternalServerErrorException({ error: 'Failed to replay webhook event' });
    }
  }

  @Post(':id/replay-dry-run')
  @ApiOperation({
    summary: 'Replay webhook event as dry run',
    description: 'Replay a historical webhook event without side effects.',
    operationId: 'webhook_events_replay_dry_run'
  })
  @ApiBody({ type: ReplayWebhookEventDto })
  @ApiOkResponse({ description: 'OK', type: ReplayWebhookEventResponseDto })
  async replayDryRun(@Req() req: Request, @Param('id') id: string, @Body() body: ReplayWebhookEventDto) {
    try {
      const user = this.requireUser(req);
      const event = await this.webhookEventsService.getEvent(String(id ?? '').trim());
      if (!this.repoAccessService.isAdmin(user)) {
        await this.repoAccessService.requireRepoManage(user, event.repoId);
      }
      const replayed = await this.webhookEventsService.replayEvent(event.id, user.id, body, { dryRun: true });
      return { event: replayed };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[webhooks] replay dry run failed', err);
      throw new InternalServerErrorException({ error: 'Failed to replay webhook event as dry run' });
    }
  }
}
