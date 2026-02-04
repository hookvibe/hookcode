import { Controller, Get, HttpException, InternalServerErrorException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { DashboardSidebarResponseDto } from './dto/dashboard-swagger.dto';
import { TaskService } from './task.service';
import { PreviewService } from './preview.service';

@AuthScopeGroup('tasks') // Scope dashboard APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('dashboard')
@ApiTags('Dashboard')
@ApiBearerAuth('bearerAuth')
export class DashboardController {
  constructor(
    private readonly taskService: TaskService,
    private readonly previewService: PreviewService
  ) {}

  private attachTaskPermissions(tasks: any[]): any[] {
    return tasks.map((t) => ({
      ...t,
      permissions: { canManage: true }
    }));
  }

  @Get('sidebar')
  @ApiOperation({
    summary: 'Dashboard sidebar snapshot',
    description: 'Fetch task stats + per-status task lists + task groups in a single request.',
    operationId: 'dashboard_sidebar'
  })
  @ApiOkResponse({ description: 'OK', type: DashboardSidebarResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async sidebar(
    @Query('tasksLimit') tasksLimitRaw: string | undefined,
    @Query('taskGroupsLimit') taskGroupsLimitRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined
  ) {
    try {
      // Reduce redundant sidebar polling calls by serving a consistent snapshot in one request. 7bqwou6abx4ste96ikhv
      const tasksLimit = parsePositiveInt(tasksLimitRaw, 3);
      const taskGroupsLimit = parsePositiveInt(taskGroupsLimitRaw, 50);
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const eventType = normalizeString(eventTypeRaw);

      const [stats, queued, processing, success, failed, taskGroups] = await Promise.all([
        this.taskService.getTaskStats({
          repoId,
          robotId,
          eventType: eventType as any
        }),
        this.taskService.listTasks({
          limit: tasksLimit,
          repoId,
          robotId,
          status: 'queued',
          eventType: eventType as any,
          includeMeta: true,
          // Skip queue diagnosis for sidebar summaries to reduce DB load. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
          includeQueue: false
        }),
        this.taskService.listTasks({
          limit: tasksLimit,
          repoId,
          robotId,
          status: 'processing',
          eventType: eventType as any,
          includeMeta: true,
          // Skip queue diagnosis for sidebar summaries to reduce DB load. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
          includeQueue: false
        }),
        this.taskService.listTasks({
          limit: tasksLimit,
          repoId,
          robotId,
          status: 'success',
          eventType: eventType as any,
          includeMeta: true,
          // Skip queue diagnosis for sidebar summaries to reduce DB load. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
          includeQueue: false
        }),
        this.taskService.listTasks({
          limit: tasksLimit,
          repoId,
          robotId,
          status: 'failed',
          eventType: eventType as any,
          includeMeta: true,
          // Skip queue diagnosis for sidebar summaries to reduce DB load. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
          includeQueue: false
        }),
        this.taskService.listTaskGroups({
          limit: taskGroupsLimit,
          repoId,
          robotId,
          includeMeta: true
        })
      ]);

      const sanitize = (tasks: any[]): any[] => {
        const decorated = this.attachTaskPermissions(tasks);
        return decorated.map((t) =>
          sanitizeTaskForViewer(t, {
            // Dashboard list never returns logs/outputText (fetch logs via `/tasks/:id/logs` or SSE stream).
            canViewLogs: false,
            includeOutputText: false
          })
        );
      };

      // Annotate task-group sidebar rows with preview activity state. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
      const previewActiveIds = this.previewService.getActiveTaskGroupIds();
      const decoratedTaskGroups = taskGroups.map((group) => ({
        ...group,
        previewActive: previewActiveIds.has(group.id)
      }));

      return {
        stats,
        tasksByStatus: {
          queued: sanitize(queued as any[]),
          processing: sanitize(processing as any[]),
          success: sanitize(success as any[]),
          failed: sanitize(failed as any[])
        },
        taskGroups: decoratedTaskGroups
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[dashboard] sidebar failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch dashboard sidebar' });
    }
  }
}
