import { Controller, Get, HttpException, InternalServerErrorException, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { TaskService } from './task.service';
import { PreviewService } from './preview.service';
import { GetTaskGroupResponseDto, ListTaskGroupsResponseDto, ListTasksByGroupResponseDto } from './dto/task-groups-swagger.dto';

const normalizeArchiveScope = (value: unknown): 'active' | 'archived' | 'all' => {
  // Keep query parsing tolerant so the Archive page can use `archived=1` while default behavior stays "active only". qnp1mtxhzikhbi0xspbc
  const raw = normalizeString(value);
  if (!raw || raw === '0' || raw === 'false' || raw === 'active') return 'active';
  if (raw === '1' || raw === 'true' || raw === 'archived') return 'archived';
  if (raw === 'all') return 'all';
  return 'active';
};

@AuthScopeGroup('tasks') // Scope task-group APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('task-groups')
@ApiTags('Task Groups')
@ApiBearerAuth('bearerAuth')
export class TaskGroupsController {
  constructor(
    private readonly taskService: TaskService,
    private readonly previewService: PreviewService
  ) {}

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
    @Query('kind') kindRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined
  ) {
    try {
      const limit = parsePositiveInt(limitRaw, 50);
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const kind = normalizeString(kindRaw);
      const archived = normalizeArchiveScope(archivedRaw);

      const taskGroups = await this.taskService.listTaskGroups({
        limit,
        repoId,
        robotId,
        kind: kind as any,
        archived,
        includeMeta: true
      });

      // Attach preview activity to task-group list rows for sidebar indicators. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
      const previewActiveIds = this.previewService.getActiveTaskGroupIds();
      const decorated = taskGroups.map((group) => ({
        ...group,
        previewActive: previewActiveIds.has(group.id)
      }));

      return { taskGroups: decorated };
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
      // Decorate single task-group payloads with preview activity state. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
      const previewActiveIds = this.previewService.getActiveTaskGroupIds();
      return { taskGroup: { ...taskGroup, previewActive: previewActiveIds.has(taskGroup.id) } };
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
