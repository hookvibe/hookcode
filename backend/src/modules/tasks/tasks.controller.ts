import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res
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
import { TaskGitPushService } from './task-git-push.service';
import { TaskRunner } from './task-runner.service';
import { TaskService } from './task.service';
import type { TaskStatus } from '../../types/task';
import { isTaskLogsEnabled } from '../../config/features';
import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';
import { computeTaskLogsDelta, extractTaskLogsSnapshot, sliceLogsTail } from '../../services/taskLogs';
import { isTruthy } from '../../utils/env';
import { normalizeString, parseOptionalBoolean, parsePositiveInt } from '../../utils/parse';
import { extractTaskSchedule } from '../../utils/timeWindow';
import { AllowQueryToken } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SuccessResponseDto } from '../common/dto/basic-response.dto';
import {
  GetTaskResponseDto,
  ListTasksResponseDto,
  RetryTaskResponseDto,
  TaskLogsResponseDto,
  TaskStatsResponseDto,
  TaskVolumeByDayResponseDto
} from './dto/tasks-swagger.dto';

@Controller('tasks')
@ApiTags('Tasks')
@ApiBearerAuth('bearerAuth')
export class TasksController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskLogStream: TaskLogStream,
    private readonly taskRunner: TaskRunner,
    private readonly taskGitPushService: TaskGitPushService
  ) {}

  private normalizeTaskStatusFilter(value: unknown): TaskStatus | 'success' | undefined {
    const raw = normalizeString(value);
    if (!raw) return undefined;
    if (raw === 'success') return 'success';
    if (raw === 'queued' || raw === 'processing' || raw === 'succeeded' || raw === 'failed' || raw === 'commented') {
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

  private attachTaskPermissions(tasks: any[]): any[] {
    return tasks.map((t) => ({
      ...t,
      permissions: { canManage: true }
    }));
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

  @Get()
  @ApiOperation({
    summary: 'List tasks',
    description: 'List tasks with optional filters.',
    operationId: 'tasks_list'
  })
  // Add includeQueue query support to control queue diagnosis payloads. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  @ApiQuery({ name: 'includeQueue', required: false, description: 'Include queue diagnosis fields for queued tasks.' })
  @ApiOkResponse({ description: 'OK', type: ListTasksResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Query('limit') limitRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('status') statusRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined,
    @Query('includeQueue') includeQueueRaw: string | undefined
  ) {
    try {
      const limit = parsePositiveInt(limitRaw, 50);
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const status = this.normalizeTaskStatusFilter(statusRaw);
      const eventType = normalizeString(eventTypeRaw);
      const archived = this.normalizeArchiveScope(archivedRaw);
      const includeQueue = parseOptionalBoolean(includeQueueRaw);

      if (normalizeString(statusRaw) && !status) {
        throw new BadRequestException({ error: 'Invalid status' });
      }

      const tasks = await this.taskService.listTasks({
        limit,
        repoId,
        robotId,
        status,
        eventType: eventType as any,
        archived,
        includeMeta: true,
        // Allow list callers to skip queue diagnosis for faster summary reads. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
        includeQueue: includeQueue ?? true
      });
      const decorated = this.attachTaskPermissions(tasks as any[]);
      const sanitized = decorated.map((t) =>
        sanitizeTaskForViewer(t, {
          // List API never returns logs (they are fetched via `/tasks/:id/logs` or SSE stream).
          canViewLogs: false,
          includeOutputText: false
        })
      );
      return { tasks: sanitized };
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
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined
  ) {
    try {
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const eventType = normalizeString(eventTypeRaw);
      const archived = this.normalizeArchiveScope(archivedRaw);

      const stats = await this.taskService.getTaskStats({
        repoId,
        robotId,
        eventType: eventType as any,
        archived
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
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('startDay') startDayRaw: string | undefined,
    @Query('endDay') endDayRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined
  ) {
    try {
      const repoId = normalizeString(repoIdRaw);
      if (!repoId) {
        throw new BadRequestException({ error: 'repoId is required' });
      }

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
  @ApiOkResponse({ description: 'OK', type: TaskLogsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async logs(@Param('id') id: string, @Query('tail') tailRaw: string | undefined) {
    try {
      if (!isTaskLogsEnabled()) {
        throw new NotFoundException({ error: 'Task logs are disabled' });
      }
      const task = await this.taskService.getTask(id);
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }

      const tail = parsePositiveInt(tailRaw, 0);
      const { logs } = extractTaskLogsSnapshot(task);
      const sliced = sliceLogsTail(logs, tail);
      return { logs: sliced };
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
  async clearLogs(@Param('id') id: string) {
    try {
      if (!isTaskLogsEnabled()) {
        throw new NotFoundException({ error: 'Task logs are disabled' });
      }
      const task = await this.taskService.getTask(id);
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }

      await this.taskService.patchResult(id, { logs: [], logsSeq: 0 });
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
      if (!isTaskLogsEnabled()) {
        return res.status(404).json({ error: 'Task logs are disabled' });
      }
      const taskId = id;
      const task = await this.taskService.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const tail = parsePositiveInt(tailRaw, 200);
      const snapshot = extractTaskLogsSnapshot(task);
      const sliced = sliceLogsTail(snapshot.logs, tail);
      let seenSeq = snapshot.seq;

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

      // Send an initial snapshot so the frontend can render existing logs immediately.
      writeEvent('init', { logs: sliced });

      // Cross-process/container: push incremental logs by polling the DB (instead of pure in-memory publish).
      // Keep the in-memory subscription as well for better real-time behavior in single-process (inline worker) mode.
      let polling = false;
      const pollTimer = setInterval(async () => {
        if (polling) return;
        polling = true;
        try {
          const latest = await this.taskService.getTask(taskId);
          if (!latest) return;
          const nextSnapshot = extractTaskLogsSnapshot(latest);
          const delta = computeTaskLogsDelta({ seenSeq, snapshot: nextSnapshot });

          if (delta.type === 'append') {
            for (const line of delta.lines) {
              writeEvent('log', { line });
            }
            seenSeq = delta.nextSeenSeq;
          } else if (delta.type === 'resync') {
            writeEvent('init', { logs: sliceLogsTail(delta.logs, tail) });
            seenSeq = delta.nextSeenSeq;
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
        seenSeq += 1;
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
  async get(@Param('id') id: string) {
    try {
      const task = await this.taskService.getTask(id, { includeMeta: true });
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      const [decorated] = this.attachTaskPermissions([task] as any[]);
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
  async retry(@Param('id') id: string, @Query('force') forceRaw: string | undefined) {
    try {
      const force = isTruthy(forceRaw, false);
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      // Prevent retrying archived tasks because the worker intentionally skips them. qnp1mtxhzikhbi0xspbc
      if (existing.archivedAt) {
        throw new ConflictException({ error: 'Task is archived; retry is blocked' });
      }

      if (existing.status === 'processing' && !force) {
        const staleMs = Number(process.env.PROCESSING_STALE_MS || 30 * 60 * 1000);
        const updatedAt = new Date(existing.updatedAt).getTime();
        const now = Date.now();
        const isStale = Number.isFinite(updatedAt) && now - updatedAt > staleMs;
        if (!isStale) {
          throw new ConflictException({
            error: 'Task is processing; retry is blocked unless stale or force=true'
          });
        }
      }

      const task = await this.taskService.retryTask(id);
      if (!task) {
        throw new NotFoundException({ error: 'Task not found' });
      }
      if (isTruthy(process.env.INLINE_WORKER_ENABLED, true)) {
        this.taskRunner.trigger().catch((err: unknown) => console.error('[tasks] trigger task runner failed', err));
      }
      const [decorated] = this.attachTaskPermissions([task] as any[]);
      return { task: decorated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[tasks] retry failed', err);
      throw new InternalServerErrorException({ error: 'Failed to retry task' });
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
  async executeNow(@Param('id') id: string) {
    try {
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }
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
      if (isTruthy(process.env.INLINE_WORKER_ENABLED, true)) {
        this.taskRunner.trigger().catch((err: unknown) => console.error('[tasks] trigger task runner failed', err));
      }
      const [decorated] = this.attachTaskPermissions([task] as any[]);
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
  async pushGit(@Param('id') id: string) {
    try {
      // Push forked changes and return refreshed git status for the UI. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const task = await this.taskGitPushService.pushTask(id);
      const [decorated] = this.attachTaskPermissions([task] as any[]);
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

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete task',
    description: 'Delete a task by id.',
    operationId: 'tasks_delete'
  })
  @ApiOkResponse({ description: 'OK', type: SuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async delete(@Param('id') id: string) {
    try {
      const existing = await this.taskService.getTask(id);
      if (!existing) {
        throw new NotFoundException({ error: 'Task not found' });
      }

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
