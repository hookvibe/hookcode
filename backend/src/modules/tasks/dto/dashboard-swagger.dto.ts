import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatusStatsDto, TaskWithMetaDto } from './tasks-swagger.dto';
import { TaskGroupWithMetaDto } from './task-groups-swagger.dto';

// Swagger DTOs for the dashboard sidebar snapshot endpoint. 7bqwou6abx4ste96ikhv

export class DashboardSidebarTasksByStatusDto {
  @ApiProperty({ type: TaskWithMetaDto, isArray: true })
  queued!: TaskWithMetaDto[];

  @ApiProperty({ type: TaskWithMetaDto, isArray: true })
  processing!: TaskWithMetaDto[];

  @ApiProperty({ type: TaskWithMetaDto, isArray: true })
  success!: TaskWithMetaDto[];

  @ApiProperty({ type: TaskWithMetaDto, isArray: true })
  failed!: TaskWithMetaDto[];
}

export class DashboardSidebarTasksByStatusNextCursorDto {
  // Provide per-status cursors to load more tasks from the sidebar. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  @ApiPropertyOptional()
  queued?: string;

  @ApiPropertyOptional()
  processing?: string;

  @ApiPropertyOptional()
  success?: string;

  @ApiPropertyOptional()
  failed?: string;
}

export class DashboardSidebarResponseDto {
  @ApiProperty({ type: TaskStatusStatsDto })
  stats!: TaskStatusStatsDto;

  @ApiProperty({ type: DashboardSidebarTasksByStatusDto })
  tasksByStatus!: DashboardSidebarTasksByStatusDto;

  @ApiProperty({ type: TaskGroupWithMetaDto, isArray: true })
  taskGroups!: TaskGroupWithMetaDto[];

  // Surface pagination cursor for sidebar task-group load-more behavior. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  @ApiPropertyOptional()
  taskGroupsNextCursor?: string;

  // Surface per-status cursors for sidebar task lists. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  @ApiPropertyOptional({ type: DashboardSidebarTasksByStatusNextCursorDto })
  tasksByStatusNextCursor?: DashboardSidebarTasksByStatusNextCursorDto;
}
