import { BadRequestException, Body, Controller, Get, HttpException, InternalServerErrorException, NotFoundException, Param, Patch, Query, Req, UnauthorizedException } from '@nestjs/common';
// Import Swagger ApiQuery to keep task-group query docs available at runtime. docs/en/developer/plans/apiquery-fix-20260227/task_plan.md apiquery-fix-20260227
import { ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { decodeUpdatedAtCursor, encodeUpdatedAtCursor } from '../../utils/pagination'; // Share cursor parsing/encoding for task-group pagination. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { TaskService } from './task.service';
import { PreviewService } from './preview.service';
import { GetTaskGroupResponseDto, ListTaskGroupsResponseDto, ListTasksByGroupResponseDto } from './dto/task-groups-swagger.dto';
import { SkillsService } from '../skills/skills.service';
import { SkillSelectionPatchDto, SkillSelectionResponseDto } from '../skills/dto/skill-selection.dto';
import { RepoAccessService } from '../repositories/repo-access.service';

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
    private readonly previewService: PreviewService,
    private readonly skillsService: SkillsService,
    private readonly repoAccessService: RepoAccessService
  ) {}

  @Get()
  // Enforce repo access for task-group queries. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  @ApiOperation({
    summary: 'List task groups',
    description: 'List task groups with optional filters.',
    operationId: 'task_groups_list'
  })
  // Document cursor-based pagination for task-group lists. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor for fetching the next page of task groups.' })
  @ApiOkResponse({ description: 'OK', type: ListTaskGroupsResponseDto })
  // Document bad-request responses for cursor parsing errors. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(
    @Req() req: Request,
    @Query('limit') limitRaw: string | undefined,
    @Query('cursor') cursorRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('kind') kindRaw: string | undefined,
    @Query('archived') archivedRaw: string | undefined
  ) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const limit = parsePositiveInt(limitRaw, 50);
      const cursor = decodeUpdatedAtCursor(cursorRaw);
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const kind = normalizeString(kindRaw);
      const archived = normalizeArchiveScope(archivedRaw);
      if (cursorRaw && !cursor) {
        // Reject invalid cursors so pagination stays deterministic. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
        throw new BadRequestException({ error: 'Invalid cursor' });
      }
      if (repoId) {
        await this.repoAccessService.requireRepoRead(req.user, repoId);
      }
      const allowedRepoIds = repoId ? undefined : await this.repoAccessService.listAccessibleRepoIds(req.user);

      const taskGroups = await this.taskService.listTaskGroups({
        limit,
        cursor: cursor ?? undefined,
        repoId,
        robotId,
        kind: kind as any,
        archived,
        includeMeta: true,
        allowedRepoIds: allowedRepoIds ?? undefined
      });

      // Attach preview activity to task-group list rows for sidebar indicators. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
      const previewActiveIds = this.previewService.getActiveTaskGroupIds();
      const decorated = taskGroups.map((group) => ({
        ...group,
        previewActive: previewActiveIds.has(group.id)
      }));

      // Emit a nextCursor when the page is full to enable keyset pagination. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
      const last = decorated[decorated.length - 1];
      const lastUpdatedAt = last ? new Date(last.updatedAt) : null;
      const nextCursor =
        last && lastUpdatedAt && !Number.isNaN(lastUpdatedAt.getTime()) && decorated.length === limit
          ? encodeUpdatedAtCursor({ id: last.id, updatedAt: lastUpdatedAt })
          : undefined;
      return { taskGroups: decorated, ...(nextCursor ? { nextCursor } : {}) };
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
  async get(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const taskGroup = await this.taskService.getTaskGroup(id, { includeMeta: true });
      if (!taskGroup) {
        throw new NotFoundException({ error: 'Task group not found' });
      }
      if (taskGroup.repoId) {
        await this.repoAccessService.requireRepoRead(req.user, String(taskGroup.repoId));
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

  @Get(':id/skills')
  @ApiOperation({
    summary: 'Get task group skills',
    description: 'Get task-group skill selection with repo-default inheritance.',
    operationId: 'task_groups_skills_get'
  })
  @ApiOkResponse({ description: 'OK', type: SkillSelectionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getSkills(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      // Surface task-group skill selections for the chat composer UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const taskGroup = await this.taskService.getTaskGroup(id);
      if (!taskGroup) {
        throw new NotFoundException({ error: 'Task group not found' });
      }
      if (taskGroup.repoId) {
        await this.repoAccessService.requireRepoRead(req.user, String(taskGroup.repoId));
      }
      const selection = await this.skillsService.resolveTaskGroupSkillSelection(id);
      if (!selection) {
        throw new NotFoundException({ error: 'Task group not found' });
      }
      return { selection };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[task-groups] skills get failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch task group skills' });
    }
  }

  @Patch(':id/skills')
  @ApiOperation({
    summary: 'Update task group skills',
    description: 'Update task-group skill selection overrides.',
    operationId: 'task_groups_skills_update'
  })
  @ApiOkResponse({ description: 'OK', type: SkillSelectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async updateSkills(@Req() req: Request, @Param('id') id: string, @Body() body: SkillSelectionPatchDto) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      // Persist task-group skill overrides for conversation-level control. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const taskGroup = await this.taskService.getTaskGroup(id);
      if (!taskGroup) {
        throw new NotFoundException({ error: 'Task group not found' });
      }
      if (taskGroup.repoId) {
        await this.repoAccessService.requireRepoManage(req.user, String(taskGroup.repoId));
      }
      const selectionRaw = body?.selection;
      const selection = selectionRaw === null ? null : Array.isArray(selectionRaw) ? selectionRaw : undefined;
      if (selection === undefined) {
        throw new BadRequestException({ error: 'selection is required' });
      }
      const updated = await this.skillsService.updateTaskGroupSkillSelection(id, selection);
      if (!updated) {
        throw new NotFoundException({ error: 'Task group not found' });
      }
      return { selection: updated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[task-groups] skills update failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update task group skills' });
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
  async tasks(@Req() req: Request, @Param('id') id: string, @Query('limit') limitRaw: string | undefined) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const limit = parsePositiveInt(limitRaw, 50);
      const taskGroup = await this.taskService.getTaskGroup(id);
      if (!taskGroup) throw new NotFoundException({ error: 'Task group not found' });
      if (taskGroup.repoId) {
        await this.repoAccessService.requireRepoRead(req.user, String(taskGroup.repoId));
      }
      const tasks = await this.taskService.listTasksByGroup(id, { limit, includeMeta: true });
      const isAdmin = this.repoAccessService.isAdmin(req.user);
      const role = taskGroup.repoId && !isAdmin
        ? await this.repoAccessService.getRepoRole(req.user.id, String(taskGroup.repoId))
        : 'owner';
      const canManage = this.repoAccessService.buildRepoPermissions(role as any, isAdmin).canManage;
      const decorated = tasks.map((t) => ({ ...t, permissions: { canManage } }));
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
