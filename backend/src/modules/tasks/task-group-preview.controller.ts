import { Controller, Get, HttpException, InternalServerErrorException, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AllowQueryToken, AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { parsePositiveInt } from '../../utils/parse';
import { PreviewLogStream } from './preview-log-stream.service';
import { PreviewService, PreviewServiceError } from './preview.service';
import {
  PreviewStartResponseDto,
  PreviewStatusResponseDto,
  PreviewStopResponseDto
} from './dto/task-group-preview.dto';

@AuthScopeGroup('tasks') // Scope task-group preview APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('task-groups')
@ApiTags('Task Groups')
@ApiBearerAuth('bearerAuth')
// Provide TaskGroup preview control endpoints for dev server orchestration. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export class TaskGroupPreviewController {
  // Include preview log stream for SSE log endpoints. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  constructor(
    private readonly previewService: PreviewService,
    private readonly previewLogStream: PreviewLogStream
  ) {}

  @Post(':id/preview/start')
  @ApiOperation({
    summary: 'Start TaskGroup preview',
    description: 'Start configured dev-server previews for a task group.',
    operationId: 'task_groups_preview_start'
  })
  @ApiOkResponse({ description: 'OK', type: PreviewStartResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async start(@Param('id') id: string): Promise<PreviewStartResponseDto> {
    try {
      const snapshot = await this.previewService.startPreview(id);
      return { success: true, instances: snapshot.instances };
    } catch (err) {
      this.handleError(err, '[task-groups] preview start failed');
    }
  }

  @Post(':id/preview/stop')
  @ApiOperation({
    summary: 'Stop TaskGroup preview',
    description: 'Stop configured dev-server previews for a task group.',
    operationId: 'task_groups_preview_stop'
  })
  @ApiOkResponse({ description: 'OK', type: PreviewStopResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async stop(@Param('id') id: string): Promise<PreviewStopResponseDto> {
    try {
      await this.previewService.stopPreview(id);
      return { success: true };
    } catch (err) {
      this.handleError(err, '[task-groups] preview stop failed');
    }
  }

  @Get(':id/preview/status')
  @ApiOperation({
    summary: 'Get TaskGroup preview status',
    description: 'Fetch preview availability and runtime status for a task group.',
    operationId: 'task_groups_preview_status'
  })
  @ApiOkResponse({ description: 'OK', type: PreviewStatusResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async status(@Param('id') id: string): Promise<PreviewStatusResponseDto> {
    try {
      return await this.previewService.getStatus(id);
    } catch (err) {
      this.handleError(err, '[task-groups] preview status failed');
    }
  }

  // Stream preview instance logs via SSE for live debugging. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @Get(':id/preview/:instanceName/logs')
  @AllowQueryToken()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'SSE: preview logs stream',
    description: 'Stream preview instance logs via Server-Sent Events (EventSource). Supports ?token= for headerless clients.',
    operationId: 'task_groups_preview_logs_stream'
  })
  @ApiOkResponse({ description: 'OK' })
  async logsStream(
    @Param('id') id: string,
    @Param('instanceName') instanceName: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('tail') tailRaw?: string
  ) {
    try {
      const tail = parsePositiveInt(tailRaw, 200);
      const snapshot = await this.previewService.getLogSnapshot(id, instanceName, { tail });
      // Count log stream connections as preview activity to prevent idle shutdown. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      this.previewService.touchInstanceAccess(id, instanceName, 'logs');

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const writeEvent = (eventName: string, data: unknown) => {
        try {
          res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
          console.error('[preview] sse write failed', err);
        }
      };

      writeEvent('init', { instance: snapshot.instance, logs: snapshot.logs });

      const unsubscribe = this.previewLogStream.subscribe(
        PreviewLogStream.buildInstanceKey(id, instanceName),
        (event) => writeEvent('log', event.entry)
      );

      const heartbeatTimer = setInterval(() => {
        try {
          res.write(`:keep-alive\n\n`);
          this.previewService.touchInstanceAccess(id, instanceName, 'logs');
        } catch {
          // ignore
        }
      }, 25_000);

      req.on('close', () => {
        clearInterval(heartbeatTimer);
        unsubscribe();
      });

      return;
    } catch (err) {
      if (err instanceof PreviewServiceError) {
        if (err.code === 'config_missing') {
          return res.status(404).json({ error: 'Preview not configured', code: err.code });
        }
        if (err.code === 'config_invalid') {
          return res.status(409).json({ error: 'Preview config invalid', code: err.code });
        }
        if (err.code === 'instance_invalid') {
          return res.status(404).json({ error: 'Preview instance not found', code: err.code });
        }
        if (err.code === 'invalid_group') {
          return res.status(404).json({ error: 'Task group not found', code: err.code });
        }
        if (err.code === 'workspace_missing') {
          return res.status(409).json({ error: 'Task group workspace missing', code: err.code });
        }
      }
      console.error('[task-groups] preview logs failed', err);
      return res.status(500).json({ error: 'Failed to stream preview logs' });
    }
  }

  private handleError(err: unknown, logPrefix: string): never {
    if (err instanceof PreviewServiceError) {
      if (err.code === 'invalid_group') {
        throw new NotFoundException({ error: 'Task group not found', code: err.code });
      }
      if (err.code === 'workspace_missing') {
        throw new HttpException({ error: 'Task group workspace missing', code: err.code }, 409);
      }
      if (err.code === 'config_missing') {
        throw new NotFoundException({ error: 'Preview not configured', code: err.code });
      }
      // Surface invalid preview config errors as conflicts for API callers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      if (err.code === 'config_invalid') {
        throw new HttpException({ error: 'Preview config invalid', code: err.code }, 409);
      }
      if (err.code === 'missing_task') {
        throw new HttpException({ error: 'Task group has no tasks', code: err.code }, 409);
      }
      if (err.code === 'instance_invalid') {
        throw new HttpException({ error: err.message || 'Invalid preview instance', code: err.code }, 400);
      }
      if (err.code === 'dependency_failed') {
        throw new HttpException({ error: err.message || 'Dependency install failed', code: err.code }, 500);
      }
      if (err.code === 'port_unavailable') {
        throw new HttpException({ error: 'No preview ports available', code: err.code }, 503);
      }
    }

    if (err instanceof HttpException) throw err;
    console.error(logPrefix, err);
    throw new InternalServerErrorException({ error: 'Preview operation failed' });
  }
}
