import {
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { TaskLogStreamEvent } from './task-log-stream.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskLogsService } from './task-logs.service';
import { TaskGitPushService } from './task-git-push.service';
import { TaskRunner } from './task-runner.service';
import { TaskService } from './task.service';
import { TaskWorkspaceService, TaskWorkspaceServiceError } from './task-workspace.service';
import type { TaskStatus } from '../../types/task';
import { isTaskLogsEnabled } from '../../config/features';
import { db } from '../../db';
import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';
import { isTruthy, parseOptionalDurationMs } from '../../utils/env';
import { normalizeString, parseOptionalBoolean, parsePositiveInt } from '../../utils/parse';
import { decodeUpdatedAtCursor, encodeUpdatedAtCursor } from '../../utils/pagination'; // Share cursor parsing/encoding for task pagination. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
import { extractTaskSchedule } from '../../utils/timeWindow';
import { AllowQueryToken, AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SuccessResponseDto } from '../common/dto/basic-response.dto';
import { RepoAccessService, type RepoRole } from '../repositories/repo-access.service';
import { LogWriterService } from '../logs/log-writer.service';
import { WorkersConnectionService } from '../workers/workers-connection.service';
import { TASK_REORDER_ACTIONS, type TaskReorderAction } from './task-control.constants';
import {
  GetTaskResponseDto,
  ListTasksResponseDto,
  RetryTaskResponseDto,
  TaskControlResponseDto,
  TaskLogsResponseDto,
  TaskStatsResponseDto,
  TaskVolumeByDayResponseDto
} from './dto/tasks-swagger.dto';

@AuthScopeGroup('tasks') // Scope task APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('tasks')
@ApiTags('Tasks')
@ApiBearerAuth('bearerAuth')
export class TasksController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskLogStream: TaskLogStream,
    private readonly taskLogsService: TaskLogsService, // Serve paged task log reads from the log table. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    private readonly taskRunner: TaskRunner,
    private readonly taskGitPushService: TaskGitPushService,
    private readonly taskWorkspaceService: TaskWorkspaceService,
    private readonly repoAccessService: RepoAccessService,
    private readonly logWriter: LogWriterService, // Emit audit events for log-clearing actions. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    private readonly workersConnections: WorkersConnectionService
  ) {}

  private normalizeTaskStatusFilter(value: unknown): TaskStatus | 'success' | undefined {
    const raw = normalizeString(value);
    if (!raw) return undefined;
    if (raw === 'success') return 'success';
    if (
      raw === 'queued' ||
      raw === 'waiting_approval' ||
      raw === 'processing' ||
      raw === 'succeeded' ||
      raw === 'failed' ||
      raw === 'commented'
    ) {
      return raw;
    }
    return undefined;
  }

  private normalizeArchiveScope(value: unknown): 'active' | 'archived' | 'all' {
    // Keep query parsing tolerant so the Archive page can use `archived=1` while default behavior stays "active only". qnp1mtxhzikhbi0xspbc
    const raw = normalizeString(value);
    if (!raw || raw === '0' || raw === 'false' || raw === 'active') return 'active';
    if (raw === '1' || raw === 'true' || raw === 'archived') return 'archived';
    if (raw === 'all') return 'all';
    return 'active';
  }

  // Compute per-task manage permissions based on repo membership. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  private async attachTaskPermissions(tasks: any[], user: { id: string; roles?: string[] }): Promise<any[]> {
    const isAdmin = this.repoAccessService.isAdmin(user);
    if (isAdmin) {
      return tasks.map((t) => ({ ...t, permissions: { canManage: true } }));
    }
    const repoIds = Array.from(new Set(tasks.map((t) => t.repoId).filter(Boolean))) as string[];
    const memberships = repoIds.length
      ? await db.repoMember.findMany({
          where: { userId: user.id, repoId: { in: repoIds } },
          select: { repoId: true, role: true }
        })
      : [];
    // Keep membership mapper parameter typed explicitly so preview startup strict compilation avoids implicit-any failures. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    const roleMap = new Map<string, RepoRole>(
      memberships.map((row: { repoId: string; role: RepoRole | string }) => [String(row.repoId), row.role as RepoRole])
    );
    return tasks.map((t) => {
      const role = t.repoId ? roleMap.get(String(t.repoId)) ?? null : null;
      const canManage = this.repoAccessService.buildRepoPermissions(role, false).canManage;
      return { ...t, permissions: { canManage } };
    });
  }

  private parseUtcDay(value: unknown): Date | null {
    // Parse `YYYY-MM-DD` as a UTC day boundary for dashboard time series queries. dashtrendline20260119m9v2
    const day = normalizeString(value);
    if (!day) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const d = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.toISOString().slice(0, 10) !== day) return null;
    return d;
  }

  // Enforce repo-based access on task operations. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  private async requireTaskRead(user: { id: string; roles?: string[] }, task: { repoId?: string | null }) {
    if (task.repoId) {
      await this.repoAccessService.requireRepoRead(user, String(task.repoId));
    }
  }

  private async requireTaskManage(user: { id: string; roles?: string[] }, task: { repoId?: string | null }) {
    if (task.repoId) {
      await this.repoAccessService.requireRepoManage(user, String(task.repoId));
    }
  }

  @Get()
  @ApiOperation({
    summary: 'List tasks',
    description: 'List tasks with optional filters.',
    operationId: 'tasks_list'
  })
  // Add includeQueue query support to control queue diagnosis payloads. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  @ApiQuery({ name: 'includeQueue', required: false, description: 'Include queue diagnosis fields for queued tasks.' })
  // Document cursor-based pagination for task lists. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor for fetching the next page of tasks.' })
  @ApiOkResponse({ description: 'OK', type: ListTasksResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Req() req: Request,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('status') statusRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined,
    @Query('includeQueue') includeQueueRaw: string | undefined
  ) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const limit = parsePositiveInt(limitRaw, 50);
      const cursor = decodeUpdatedAtCursor(cursorRaw);
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const status = this.normalizeTaskStatusFilter(statusRaw);
      const eventType = normalizeString(eventTypeRaw);
      const archived = this.normalizeArchiveScope(archivedRaw);
      const includeQueue = parseOptionalBoolean(includeQueueRaw);

      if (cursorRaw && !cursor) {
        // Reject invalid cursors so pagination stays deterministic. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
        throw new BadRequestException({ error: 'Invalid cursor' });
      }
      if (normalizeString(statusRaw) && !status) {
        throw new BadRequestException({ error: 'Invalid status' });
      }

      if (repoId) {
        await this.repoAccessService.requireRepoRead(req.user, repoId);
      }
      const allowedRepoIds = repoId ? undefined : await this.repoAccessService.listAccessibleRepoIds(req.user);
      const tasks = await this.taskService.listTasks({
        limit,
        cursor: cursor ?? undefined,
        repoId,
        robotId,
        status,
        eventType: eventType as any,
        archived,
        allowedRepoIds: allowedRepoIds ?? undefined,
        includeMeta: true,
        // Allow list callers to skip queue diagnosis for faster summary reads. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
        includeQueue: includeQueue ?? true
      });
      const decorated = await this.attachTaskPermissions(tasks as any[], req.user);
      const sanitized = decorated.map((t) =>
        sanitizeTaskForViewer(t, {
          // List API never returns logs (they are fetched via `/tasks/:id/logs` or SSE stream).
          canViewLogs: false,
          includeOutputText: false
        })
      );
      // Emit a nextCursor when the page is full to enable keyset pagination. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
      const last = sanitized[sanitized.length - 1];
      const lastUpdatedAt = last ? new Date(last.updatedAt) : null;
      const nextCursor =
        last && lastUpdatedAt && !Number.isNaN(lastUpdatedAt.getTime()) && sanitized.length === limit
          ? encodeUpdatedAtCursor({ id: last.id, updatedAt: lastUpdatedAt })
          : undefined;
      return { tasks: sanitized, ...(nextCursor ? { nextCursor } : {}) };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] list failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch tasks' });
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Task stats',
    description: 'Aggregate task status counts with optional filters.',
    operationId: 'tasks_stats'
  })
  @ApiOkResponse({ description: 'OK', type: TaskStatsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async stats(
    @Req() req: Request,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined
  ) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const eventType = normalizeString(eventTypeRaw);
      const archived = this.normalizeArchiveScope(archivedRaw);

      if (repoId) {
        await this.repoAccessService.requireRepoRead(req.user, repoId);
      }
      const allowedRepoIds = repoId ? undefined : await this.repoAccessService.listAccessibleRepoIds(req.user);
      const stats = await this.taskService.getTaskStats({
        repoId,
        robotId,
        eventType: eventType as any,
        archived,
        allowedRepoIds: allowedRepoIds ?? undefined
      });

      return { stats };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] stats failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task stats' });
    }
  }

  @Get('volume')
  @ApiOperation({
    summary: 'Task volume by day',
    description: 'Aggregate task counts by UTC day for a given repo and date range.',
    operationId: 'tasks_volume_by_day'
  })
  @ApiOkResponse({ description: 'OK', type: TaskVolumeByDayResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async volumeByDay(
    @Req() req: Request,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('startDay') startDayRaw: string | undefined,
    @Query('endDay') endDayRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined
  ) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const repoId = normalizeString(repoIdRaw);
      if (!repoId) {
        throw new BadRequestException({ error: 'repoId is required' });
      }
      await this.repoAccessService.requireRepoRead(req.user, repoId);

      const start = this.parseUtcDay(startDayRaw);
      const end = this.parseUtcDay(endDayRaw);
      if (!start || !end) {
        throw new BadRequestException({ error: 'Invalid date range' });
      }
      if (end.getTime() < start.getTime()) {
        throw new BadRequestException({ error: 'Invalid date range' });
      }

      const endExclusive = new Date(end);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      const days = Math.round((endExclusive.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      if (days <= 0) {
        throw new BadRequestException({ error: 'Invalid date range' });
      }
      if (days > 1100) {
        throw new BadRequestException({ error: 'Date range is too large' });
      }

      const robotId = normalizeString(robotIdRaw);
      const eventType = normalizeString(eventTypeRaw);
      const archived = this.normalizeArchiveScope(archivedRaw);

      const points = await this.taskService.getTaskVolumeByDay({
        repoId,
        start,
        endExclusive,
        robotId,
        eventType: eventType as any,
        archived
      });

      return { points };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] volume by day failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task volume' });
    }
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Get task logs',
    description: 'Fetch task logs (requires task logs feature enabled).',
    operationId: 'tasks_logs_get'
  })
  // Document task log paging params for log table reads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  @ApiQuery({ name: 'limit', required: false, description: 'Max log lines to return (default 200, max 1000).' })
  @ApiQuery({ name: 'before', required: false, description: 'Return log lines before this sequence number.' })
  @ApiQuery({ name: 'tail', required: false, description: 'Legacy alias for limit when requesting latest log lines.' }) // Preserve tail alias docs for paged log reads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  @ApiOkResponse({ description: 'OK', type: TaskLogsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async logs(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('limit') limitRaw: string | undefined,
    @Query('before') beforeRaw: string | undefined,
    @Query('tail') tailRaw: string | undefined
  ) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      if (!isTaskLogsEnabled()) {
        throw new NotFoundException({ error: 'Task logs are disabled' });
      }
      // Use minimal task fields to avoid pulling large result_json on log reads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      const task = await this.taskService.getTaskAccessSummary(id);
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, task);

      // Resolve log paging params with backwards-compatible tail alias. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      const limit = parsePositiveInt(limitRaw ?? tailRaw, 200);
      const before = parsePositiveInt(beforeRaw, 0);
      if (beforeRaw && before <= 0) {
        throw new BadRequestException({ error: 'Invalid before cursor' });
      }
      if (before > 0) {
        return await this.taskLogsService.getBefore(id, before, limit);
      }
      return await this.taskLogsService.getTail(id, limit);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] logs failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task logs' });
    }
  }

  @Delete(':id/logs')
  @ApiOperation({
    summary: 'Clear task logs',
    description: 'Clear task logs (requires task logs feature enabled).',
    operationId: 'tasks_logs_clear'
  })
  @ApiOkResponse({ description: 'OK', type: SuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async clearLogs(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      if (!isTaskLogsEnabled()) {
        throw new NotFoundException({ error: 'Task logs are disabled' });
      }
      // Use minimal task fields to avoid pulling large result_json on log clears. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      const task = await this.taskService.getTaskAccessSummary(id);
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, task);

      // Delete persisted log rows so UI reopens with a clean log history. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      const cleared = await this.taskLogsService.clearLogs(id);
      await this.taskService.stripTaskResultLogs(id);
      void this.logWriter.logExecution({
        level: 'info',
        message: 'Task logs cleared',
        code: 'TASK_LOGS_CLEARED',
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { cleared }
      });
      return { success: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] clear logs failed', err);
      throw new InternalServerErrorException({ error: 'Failed to clear task logs' });
    }
  }

  @Get(':id/logs/stream')
  @AllowQueryToken()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'SSE: task logs stream',
    description: 'Stream task logs via Server-Sent Events (EventSource). Supports ?token= for headerless clients.',
    operationId: 'tasks_logs_stream'
  })
  @ApiOkResponse({ description: 'OK' })
  async logsStream(@Param('id') id: string, @Req() req: Request, @Res() res: Response, @Query('tail') tailRaw?: string) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      if (!isTaskLogsEnabled()) {
        return res.status(404).json({ error: 'Task logs are disabled' });
      }
      const taskId = id;
      // Use minimal task fields to avoid pulling large result_json during log streams. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      const task = await this.taskService.getTaskAccessSummary(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, task);

      const tail = parsePositiveInt(tailRaw, 200);
      const snapshot = await this.taskLogsService.getTail(taskId, tail);
      let seenSeq = snapshot.endSeq;

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const writeEvent = (eventName: string, data: unknown) => {
        try {
          res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
          console.error('[tasks] sse write failed', err);
        }
      };

      // Send an initial snapshot so the frontend can render existing logs immediately. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      writeEvent('init', {
        logs: snapshot.logs,
        startSeq: snapshot.startSeq,
        endSeq: snapshot.endSeq,
        nextBefore: snapshot.nextBefore
      });

      // Cross-process/container: push incremental logs by polling the DB (instead of pure in-memory publish).
      // Keep the in-memory subscription so colocated worker dispatch still feels immediate while DB polling covers remote executors. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      let polling = false;
      const pollTimer = setInterval(async () => {
        if (polling) return;
        polling = true;
        try {
          // Poll task_logs for new lines and reset streams after clears. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
          const maxSeq = await this.taskLogsService.getMaxSeq(taskId);
          if (maxSeq < seenSeq) {
            const reset = await this.taskLogsService.getTail(taskId, tail);
            writeEvent('init', {
              logs: reset.logs,
              startSeq: reset.startSeq,
              endSeq: reset.endSeq,
              nextBefore: reset.nextBefore
            });
            seenSeq = reset.endSeq;
            return;
          }
          const delta = await this.taskLogsService.getAfter(taskId, seenSeq, tail);
          if (delta.entries.length) {
            for (const entry of delta.entries) {
              writeEvent('log', entry);
              if (entry.seq > seenSeq) seenSeq = entry.seq;
            }
          }
        } catch (err) {
          console.error('[tasks] sse poll failed', err);
        } finally {
          polling = false;
        }
      }, 1000);

      const heartbeatTimer = setInterval(() => {
        try {
          res.write(`:keep-alive\n\n`);
        } catch {
          // ignore
        }
      }, 25_000);

      const unsubscribe = this.taskLogStream.subscribe(taskId, (ev: TaskLogStreamEvent) => {
        writeEvent('log', ev);
        if (ev.seq > seenSeq) seenSeq = ev.seq;
      });

      req.on('close', () => {
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        unsubscribe();
      });

      return;
    } catch (err) {
      console.error('[tasks] logs stream failed', err);
      return res.status(500).json({ error: 'Failed to stream task logs' });
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get task',
    description: 'Get a task by id.',
    operationId: 'tasks_get'
  })
  @ApiOkResponse({ description: 'OK', type: GetTaskResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async get(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const task = await this.taskService.getTask(id, { includeMeta: true });
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskRead(req.user, task);
      const [decorated] = await this.attachTaskPermissions([task] as any[], req.user);
      const sanitized = sanitizeTaskForViewer(decorated, {
        canViewLogs: Boolean(decorated?.permissions?.canManage) && isTaskLogsEnabled(),
        includeOutputText: true
      });
      return { task: sanitized };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] get failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task' });
    }
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Retry task',
    description: 'Retry a task. Use force=true to retry a processing task when allowed.',
    operationId: 'tasks_retry'
  })
  @ApiOkResponse({ description: 'OK', type: RetryTaskResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async retry(@Req() req: Request, @Param('id') id: string, @Query('force') forceRaw: string | undefined) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const force = isTruthy(forceRaw, false);
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, existing);
      // Prevent retrying archived tasks because the worker intentionally skips them. qnp1mtxhzikhbi0xspbc
      if (existing.archivedAt) {
        throw new ConflictException({ error: 'Task is archived; retry is blocked' });
      }

      if (existing.status === 'processing' && !force) {
        // Respect blank/zero PROCESSING_STALE_MS so retry gating does not treat tasks as stale. docs/en/developer/plans/stale-disable-20260305/task_plan.md stale-disable-20260305
        const staleMs = parseOptionalDurationMs(process.env.PROCESSING_STALE_MS, 30 * 60 * 1000);
        const updatedAt = new Date(existing.updatedAt).getTime();
        const now = Date.now();
        const isStale = staleMs !== null && Number.isFinite(updatedAt) && now - updatedAt > staleMs;
        if (!isStale) {
          const errorMessage =
            staleMs === null
              ? 'Task is processing; retry is blocked unless force=true (stale timeout is disabled)'
              : 'Task is processing; retry is blocked unless stale or force=true';
          throw new ConflictException({
            error: errorMessage
          });
        }
      }

      const task = await this.taskService.retryTask(id);
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      // Kick the dispatcher after queue mutations so connected workers receive tasks without polling delays. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      this.taskRunner.trigger().catch((err: unknown) => console.error('[tasks] trigger task runner failed', err));
      const [decorated] = await this.attachTaskPermissions([task] as any[], req.user);
      return { task: decorated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] retry failed', err);
      throw new InternalServerErrorException({ error: 'Failed to retry task' });
    }
  }

  @Post(':id/stop')
  @ApiOperation({
    summary: 'Stop task',
    description: 'Stop a queued or processing task. Processing tasks finish as failed with a manual-stop reason.',
    operationId: 'tasks_stop'
  })
  @ApiOkResponse({ description: 'OK', type: TaskControlResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async stop(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, existing);
      if (existing.archivedAt) {
        throw new ConflictException({ error: 'Task is archived; stop is blocked' });
      }
      if (existing.status !== 'processing' && existing.status !== 'queued' && existing.status !== 'waiting_approval') {
        const [decorated] = await this.attachTaskPermissions([existing] as any[], req.user);
        return { task: decorated };
      }

      // Stop queued or processing tasks without leaving a resumable paused state behind. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
      const task = await this.taskService.stopTask(id);
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      if (task.status === 'processing' && task.workerId) {
        // Push explicit cancel messages to connected workers so manual stops do not wait solely on control-state polling. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
        this.workersConnections.sendCancelTask(task.workerId, task.id);
      }
      void this.logWriter.logOperation({
        level: 'warn',
        message: 'Task stop requested',
        code: 'TASK_STOP_REQUESTED',
        actorUserId: req.user.id,
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { status: task.status }
      });
      const [decorated] = await this.attachTaskPermissions([task] as any[], req.user);
      return { task: decorated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] stop failed', err);
      throw new InternalServerErrorException({ error: 'Failed to stop task' });
    }
  }

  @Patch(':id/content')
  @ApiOperation({
    summary: 'Edit queued task content',
    description: 'Edit the text content of a queued manual task before it starts running.',
    operationId: 'tasks_content_patch'
  })
  @ApiOkResponse({ description: 'OK', type: TaskControlResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async patchQueuedContent(@Req() req: Request, @Param('id') id: string, @Body() body: { text?: string }) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, existing);
      if (existing.archivedAt) {
        throw new ConflictException({ error: 'Task is archived; edit is blocked' });
      }
      if (existing.status !== 'queued') {
        throw new ConflictException({ error: 'Only queued tasks can be edited' });
      }

      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!text) {
        throw new BadRequestException({ error: 'text is required' });
      }

      // Allow queued manual tasks to be edited before execution begins. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
      const task = await this.taskService.updateQueuedTaskText(id, text);
      if (!task) {
        throw new ConflictException({ error: 'Task cannot be edited' });
      }
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Queued task content updated',
        code: 'TASK_CONTENT_UPDATED',
        actorUserId: req.user.id,
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { textLength: text.length }
      });
      const [decorated] = await this.attachTaskPermissions([task] as any[], req.user);
      return { task: decorated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] content patch failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update task content' });
    }
  }

  @Post(':id/reorder')
  @ApiOperation({
    summary: 'Reorder queued task',
    description: 'Move a queued task earlier, later, or to the next execution slot within its task group.',
    operationId: 'tasks_reorder'
  })
  @ApiOkResponse({ description: 'OK', type: TaskControlResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async reorder(@Req() req: Request, @Param('id') id: string, @Body() body: { action?: TaskReorderAction }) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, existing);
      if (existing.archivedAt) {
        throw new ConflictException({ error: 'Task is archived; reorder is blocked' });
      }
      if (existing.status !== 'queued') {
        throw new ConflictException({ error: 'Only queued tasks can be reordered' });
      }
      const action = typeof body?.action === 'string' ? body.action : '';
      if (!TASK_REORDER_ACTIONS.includes(action as TaskReorderAction)) {
        throw new BadRequestException({ error: 'Invalid reorder action' });
      }

      // Reorder queued tasks within the explicit task-group sequence instead of relying on timestamps. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
      const task = await this.taskService.reorderQueuedTask(id, action as TaskReorderAction);
      if (!task) {
        throw new ConflictException({ error: 'Task cannot be reordered' });
      }
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Queued task reordered',
        code: 'TASK_REORDERED',
        actorUserId: req.user.id,
        repoId: task.repoId,
        taskId: task.id,
        taskGroupId: task.groupId,
        meta: { action }
      });
      const [decorated] = await this.attachTaskPermissions([task] as any[], req.user);
      return { task: decorated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] reorder failed', err);
      throw new InternalServerErrorException({ error: 'Failed to reorder task' });
    }
  }

  @Post(':id/execute-now')
  @ApiOperation({
    summary: 'Execute task now',
    description: 'Override the configured time window so a queued task can execute immediately.',
    operationId: 'tasks_execute_now'
  })
  @ApiOkResponse({ description: 'OK', type: RetryTaskResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async executeNow(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, existing);
      if (existing.archivedAt) {
        throw new ConflictException({ error: 'Task is archived; execute-now is blocked' });
      }
      if (existing.status !== 'queued') {
        throw new ConflictException({ error: 'Task is not queued' });
      }
      const schedule = extractTaskSchedule(existing.payload);
      if (!schedule) {
        throw new ConflictException({ error: 'Task has no time window to override' });
      }

      // Allow manual override for time-windowed tasks and trigger the worker. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const task = await this.taskService.setTaskScheduleOverride(id, true);
      if (!task) {
        throw new ConflictException({ error: 'Task schedule override failed' });
      }
      // Kick the dispatcher after queue mutations so connected workers receive tasks without polling delays. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      this.taskRunner.trigger().catch((err: unknown) => console.error('[tasks] trigger task runner failed', err));
      const [decorated] = await this.attachTaskPermissions([task] as any[], req.user);
      return { task: decorated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] execute-now failed', err);
      throw new InternalServerErrorException({ error: 'Failed to execute task now' });
    }
  }

  @Post(':id/git/push')
  @ApiOperation({
    summary: 'Push git changes',
    description: 'Push forked repo changes captured by a write-enabled task.',
    operationId: 'tasks_git_push'
  })
  @ApiOkResponse({ description: 'OK', type: GetTaskResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async pushGit(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      // Push forked changes and return refreshed git status for the UI. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const existing = await this.taskService.getTask(id);
      if (!existing) throw new NotFoundException({ error: 'Task not found' });
      await this.requireTaskManage(req.user, existing);
      const task = await this.taskGitPushService.pushTask(id);
      const [decorated] = await this.attachTaskPermissions([task] as any[], req.user);
      const sanitized = sanitizeTaskForViewer(decorated, {
        canViewLogs: Boolean(decorated?.permissions?.canManage) && isTaskLogsEnabled(),
        includeOutputText: true
      });
      return { task: sanitized };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] push failed', err);
      throw new InternalServerErrorException({ error: 'Failed to push changes' });
    }
  }

  @Get(':id/workspace')
  @ApiOperation({
    summary: 'Get task workspace',
    description: 'Get the current task workspace state, file list, and diffs.',
    operationId: 'tasks_workspace_get'
  })
  @ApiOkResponse({ description: 'OK' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getWorkspace(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const existing = await this.taskService.getTask(id);
      if (!existing) throw new NotFoundException({ error: 'Task not found' });
      await this.requireTaskRead(req.user, existing);
      return { workspace: await this.taskWorkspaceService.getWorkspace(id) };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if (err instanceof TaskWorkspaceServiceError) {
        if (err.code === 'TASK_NOT_FOUND') throw new NotFoundException({ error: err.message, code: err.code });
        throw new ConflictException({ error: err.message, code: err.code });
      }
      console.error('[tasks] get workspace failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task workspace' });
    }
  }

  @Post(':id/workspace/:action')
  @ApiOperation({
    summary: 'Run task workspace action',
    description: 'Run a git/workspace action against the task workspace.',
    operationId: 'tasks_workspace_action'
  })
  @ApiOkResponse({ description: 'OK' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async runWorkspaceAction(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: { paths?: string[]; message?: string }
  ) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const existing = await this.taskService.getTask(id);
      if (!existing) throw new NotFoundException({ error: 'Task not found' });
      await this.requireTaskManage(req.user, existing);

      const normalizedAction =
        action === 'stage' ||
        action === 'unstage' ||
        action === 'discard' ||
        action === 'delete_untracked' ||
        action === 'commit'
          ? action
          : '';
      if (!normalizedAction) {
        throw new BadRequestException({ error: 'Invalid workspace action' });
      }

      return {
        result: await this.taskWorkspaceService.runOperation(id, normalizedAction, {
          paths: Array.isArray(body?.paths) ? body.paths.map((entry) => String(entry)) : undefined,
          message: typeof body?.message === 'string' ? body.message : undefined
        })
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if (err instanceof TaskWorkspaceServiceError) {
        if (err.code === 'TASK_NOT_FOUND') throw new NotFoundException({ error: err.message, code: err.code });
        throw new ConflictException({ error: err.message, code: err.code });
      }
      console.error('[tasks] workspace action failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update task workspace' });
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete task',
    description: 'Delete a task by id.',
    operationId: 'tasks_delete'
  })
  @ApiOkResponse({ description: 'OK', type: SuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async delete(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      await this.requireTaskManage(req.user, existing);

      const ok = await this.taskService.deleteTask(id);
      if (!ok) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      return { success: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] delete failed', err);
      throw new InternalServerErrorException({ error: 'Failed to delete task' });
    }
  }
}
