import { ApiProperty } from '@nestjs/swagger';
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

export class DashboardSidebarResponseDto {
  @ApiProperty({ type: TaskStatusStatsDto })
  stats!: TaskStatusStatsDto;

  @ApiProperty({ type: DashboardSidebarTasksByStatusDto })
  tasksByStatus!: DashboardSidebarTasksByStatusDto;

  @ApiProperty({ type: TaskGroupWithMetaDto, isArray: true })
  taskGroups!: TaskGroupWithMetaDto[];
}

