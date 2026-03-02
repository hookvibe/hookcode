import { BadRequestException, Controller, ForbiddenException, Get, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AllowQueryToken, AuthScopeGroup } from '../auth/auth.decorator';
import { RepoAccessService } from '../repositories/repo-access.service';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { decodeCreatedAtCursor } from '../../utils/pagination';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import type { SystemLogCategory, SystemLogLevel } from '../../types/systemLog';
import { LogsService } from './logs.service';
import { ListSystemLogsResponseDto } from './dto/logs-swagger.dto';
import { EventStreamService } from '../events/event-stream.service';

// Normalize log category filters from query params. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
const normalizeCategory = (value: unknown): SystemLogCategory | undefined => {
  const raw = normalizeString(value);
  if (raw === 'system' || raw === 'operation' || raw === 'execution') return raw;
  return undefined;
};

// Normalize log level filters from query params. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
const normalizeLevel = (value: unknown): SystemLogLevel | undefined => {
  const raw = normalizeString(value);
  if (raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return undefined;
};

@AuthScopeGroup('system') // Scope system log APIs for PAT access control. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
@Controller('logs')
@ApiTags('Logs')
@ApiBearerAuth('bearerAuth')
export class LogsController {
  constructor(
    private readonly logsService: LogsService,
    private readonly repoAccessService: RepoAccessService,
    private readonly eventStream: EventStreamService
  ) {}

  private requireAdmin(req: Request) {
    // Enforce admin-only access for system log endpoints. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (!this.repoAccessService.isAdmin(req.user)) {
      throw new ForbiddenException({ error: 'Forbidden', code: 'ADMIN_REQUIRED' });
    }
  }

  @Get()
  @ApiOperation({
    summary: 'List system logs',
    description: 'List system/audit logs with filters and cursor pagination.',
    operationId: 'logs_list'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default 50).' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor.' })
  @ApiQuery({ name: 'category', required: false, description: 'Log category filter (system/operation/execution).' })
  @ApiQuery({ name: 'level', required: false, description: 'Log level filter (info/warn/error).' })
  @ApiQuery({ name: 'repoId', required: false, description: 'Filter by repo id.' })
  @ApiQuery({ name: 'taskId', required: false, description: 'Filter by task id.' })
  @ApiQuery({ name: 'taskGroupId', required: false, description: 'Filter by task group id.' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query (message/code).' })
  @ApiOkResponse({ description: 'OK', type: ListSystemLogsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Req() req: Request,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined,
    @Query('category') categoryRaw: string | undefined,
    @Query('level') levelRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('taskId') taskIdRaw: string | undefined,
    @Query('taskGroupId') taskGroupIdRaw: string | undefined,
    @Query('q') queryRaw: string | undefined
  ) {
    this.requireAdmin(req);

    const limit = parsePositiveInt(limitRaw, 50);
    const cursor = decodeCreatedAtCursor(cursorRaw);
    if (cursorRaw && !cursor) throw new BadRequestException({ error: 'Invalid cursor' });

    const category = normalizeCategory(categoryRaw);
    if (normalizeString(categoryRaw) && !category) {
      throw new BadRequestException({ error: 'Invalid category' });
    }

    const level = normalizeLevel(levelRaw);
    if (normalizeString(levelRaw) && !level) {
      throw new BadRequestException({ error: 'Invalid level' });
    }

    return this.logsService.listLogs({
      limit,
      cursor,
      category: category ?? null,
      level: level ?? null,
      repoId: normalizeString(repoIdRaw) || null,
      taskId: normalizeString(taskIdRaw) || null,
      taskGroupId: normalizeString(taskGroupIdRaw) || null,
      query: normalizeString(queryRaw) || null
    });
  }

  @Get('stream')
  @AllowQueryToken()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'SSE: system logs stream',
    description: 'Stream system logs via Server-Sent Events (EventSource). Supports ?token= for headerless clients.',
    operationId: 'logs_stream'
  })
  @ApiOkResponse({ description: 'OK' })
  async stream(@Req() req: Request, @Res() res: Response) {
    this.requireAdmin(req);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const unsubscribe = this.eventStream.subscribe(res, { topics: ['logs'] });
    try {
      res.write(`event: ready\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    } catch {
      // ignore
    }

    req.on('close', () => {
      unsubscribe();
    });

    return;
  }
}
