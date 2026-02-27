import { Controller, Get, HttpException, InternalServerErrorException, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { db } from '../../db';
import { sanitizeTaskForViewer } from '../../services/taskResultVisibility';
import { normalizeString, parsePositiveInt } from '../../utils/parse';
import { encodeUpdatedAtCursor } from '../../utils/pagination'; // Encode sidebar task-group cursors for load-more pagination. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { DashboardSidebarResponseDto } from './dto/dashboard-swagger.dto';
import { TaskService } from './task.service';
import { PreviewService } from './preview.service';
import { RepoAccessService, type RepoRole } from '../repositories/repo-access.service';

@AuthScopeGroup('tasks') // Scope dashboard APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('dashboard')
@ApiTags('Dashboard')
@ApiBearerAuth('bearerAuth')
export class DashboardController {
  constructor(
    private readonly taskService: TaskService,
    private readonly previewService: PreviewService,
    private readonly repoAccessService: RepoAccessService
  ) {}

  // Apply repo RBAC to dashboard task summaries. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
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
    const roleMap = new Map<string, RepoRole>(memberships.map((row) => [String(row.repoId), row.role as RepoRole]));
    return tasks.map((t) => {
      const role = t.repoId ? roleMap.get(String(t.repoId)) ?? null : null;
      const canManage = this.repoAccessService.buildRepoPermissions(role, false).canManage;
      return { ...t, permissions: { canManage } };
    });
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
    @Req() req: Request,
    @Query('tasksLimit') tasksLimitRaw: string | undefined,
    @Query('taskGroupsLimit') taskGroupsLimitRaw: string | undefined,
    @Query('repoId') repoIdRaw: string | undefined,
    @Query('robotId') robotIdRaw: string | undefined,
    @Query('eventType') eventTypeRaw: string | undefined
  ) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      // Reduce redundant sidebar polling calls by serving a consistent snapshot in one request. 7bqwou6abx4ste96ikhv
      const tasksLimit = parsePositiveInt(tasksLimitRaw, 3);
      const taskGroupsLimit = parsePositiveInt(taskGroupsLimitRaw, 50);
      const repoId = normalizeString(repoIdRaw);
      const robotId = normalizeString(robotIdRaw);
      const eventType = normalizeString(eventTypeRaw);
      if (repoId) {
        await this.repoAccessService.requireRepoRead(req.user, repoId);
      }
      const allowedRepoIds = repoId ? undefined : await this.repoAccessService.listAccessibleRepoIds(req.user);

      const [stats, queued, processing, success, failed, taskGroups] = await Promise.all([
        this.taskService.getTaskStats({
          repoId,
          robotId,
          eventType: eventType as any,
          allowedRepoIds: allowedRepoIds ?? undefined
        }),
        this.taskService.listTasks({
          limit: tasksLimit,
          repoId,
          robotId,
          status: 'queued',
          eventType: eventType as any,
          includeMeta: true,
          allowedRepoIds: allowedRepoIds ?? undefined,
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
          allowedRepoIds: allowedRepoIds ?? undefined,
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
          allowedRepoIds: allowedRepoIds ?? undefined,
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
          allowedRepoIds: allowedRepoIds ?? undefined,
          // Skip queue diagnosis for sidebar summaries to reduce DB load. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
          includeQueue: false
        }),
        this.taskService.listTaskGroups({
          limit: taskGroupsLimit,
          repoId,
          robotId,
          includeMeta: true,
          allowedRepoIds: allowedRepoIds ?? undefined
        })
      ]);

      const sanitize = async (tasks: any[]): Promise<any[]> => {
        const decorated = await this.attachTaskPermissions(tasks, req.user!);
        return decorated.map((t) =>
          sanitizeTaskForViewer(t, {
            // Dashboard list never returns logs/outputText (fetch logs via `/tasks/:id/logs` or SSE stream).
            canViewLogs: false,
            includeOutputText: false
          })
        );
      };

      const buildStatusCursor = (tasks: any[]): string | undefined => {
        // Emit per-status cursors for sidebar task pagination. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
        const lastTask = tasks[tasks.length - 1];
        const lastUpdatedAt = lastTask?.updatedAt ? new Date(lastTask.updatedAt) : null;
        if (!lastTask || !lastUpdatedAt || Number.isNaN(lastUpdatedAt.getTime())) return undefined;
        if (tasks.length !== tasksLimit) return undefined;
        return encodeUpdatedAtCursor({ id: lastTask.id, updatedAt: lastUpdatedAt });
      };

      // Annotate task-group sidebar rows with preview activity state. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
      const previewActiveIds = this.previewService.getActiveTaskGroupIds();
      const decoratedTaskGroups = taskGroups.map((group) => ({
        ...group,
        previewActive: previewActiveIds.has(group.id)
      }));
      // Emit a task-group cursor for sidebar load-more pagination when the page is full. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
      const lastGroup = decoratedTaskGroups[decoratedTaskGroups.length - 1];
      const lastGroupUpdatedAt = lastGroup ? new Date(lastGroup.updatedAt) : null;
      const taskGroupsNextCursor =
        lastGroup && lastGroupUpdatedAt && !Number.isNaN(lastGroupUpdatedAt.getTime()) && decoratedTaskGroups.length === taskGroupsLimit
          ? encodeUpdatedAtCursor({ id: lastGroup.id, updatedAt: lastGroupUpdatedAt })
          : undefined;
      const tasksByStatusNextCursor = {
        queued: buildStatusCursor(queued as any[]),
        processing: buildStatusCursor(processing as any[]),
        success: buildStatusCursor(success as any[]),
        failed: buildStatusCursor(failed as any[])
      };
      const hasStatusCursor = Object.values(tasksByStatusNextCursor).some(Boolean);

      return {
        stats,
        tasksByStatus: {
          queued: await sanitize(queued as any[]),
          processing: await sanitize(processing as any[]),
          success: await sanitize(success as any[]),
          failed: await sanitize(failed as any[])
        },
        taskGroups: decoratedTaskGroups,
        ...(taskGroupsNextCursor ? { taskGroupsNextCursor } : {}),
        ...(hasStatusCursor ? { tasksByStatusNextCursor } : {})
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[dashboard] sidebar failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch dashboard sidebar' });
    }
  }
}
