import { Controller, Get, HttpException, InternalServerErrorException, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { TaskService } from './task.service';
import { GetTaskGroupResponseDto, ListTaskGroupsResponseDto, ListTasksByGroupResponseDto } from './dto/task-groups-swagger.dto';

@Controller('task-groups')
@ApiTags('Task Groups')
@ApiBearerAuth('bearerAuth')
export class TaskGroupsController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @ApiOperation({
    summary: 'List task groups',
    description: 'List task groups with optional filters.',
    operationId: 'task_groups_list'
  })
  @ApiOkResponse({ description: 'OK', type: ListTaskGroupsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Query('limit') limitRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('kind') kindRaw: string | undefined
  ) {
    try {
      const limit = parsePositiveInt(limitRaw, 50);
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const kind = normalizeString(kindRaw);

      const taskGroups = await this.taskService.listTaskGroups({
        limit,
        repoId,
        robotId,
        kind: kind as any,
        includeMeta: true
      });

      return { taskGroups };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[task-groups] list failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task groups' });
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get task group',
    description: 'Get a task group by id.',
    operationId: 'task_groups_get'
  })
  @ApiOkResponse({ description: 'OK', type: GetTaskGroupResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async get(@Param('id') id: string) {
    try {
      const taskGroup = await this.taskService.getTaskGroup(id, { includeMeta: true });
      if (!taskGroup) {
        throw new NotFoundException({ error: 'Task group not found' });
      }
      return { taskGroup };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[task-groups] get failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task group' });
    }
  }

  @Get(':id/tasks')
  @ApiOperation({
    summary: 'List tasks in task group',
    description: 'List tasks under a task group.',
    operationId: 'task_groups_tasks'
  })
  @ApiOkResponse({ description: 'OK', type: ListTasksByGroupResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async tasks(@Param('id') id: string, @Query('limit') limitRaw: string | undefined) {
    try {
      const limit = parsePositiveInt(limitRaw, 50);
      const tasks = await this.taskService.listTasksByGroup(id, { limit, includeMeta: true });
      const decorated = tasks.map((t) => ({ ...t, permissions: { canManage: true } }));
      const sanitized = decorated.map((t) =>
        sanitizeTaskForViewer(t, {
          canViewLogs: false,
          includeOutputText: false
        })
      );
      return { tasks: sanitized };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[task-groups] tasks failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task group tasks' });
    }
  }
}
