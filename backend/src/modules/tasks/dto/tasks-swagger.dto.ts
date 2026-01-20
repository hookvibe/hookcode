import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskTokenUsageDto {
  @ApiProperty()
  inputTokens!: number;

  @ApiProperty()
  outputTokens!: number;

  @ApiProperty()
  totalTokens!: number;
}

export class TaskResultDto {
  @ApiPropertyOptional({ enum: ['A', 'B', 'C', 'D'] })
  grade?: 'A' | 'B' | 'C' | 'D';

  @ApiPropertyOptional()
  goLive?: boolean;

  @ApiPropertyOptional()
  summary?: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  risks?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  suggestions?: string[];

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  logs?: string[];

  @ApiPropertyOptional()
  logsSeq?: number;

  @ApiPropertyOptional({ type: TaskTokenUsageDto })
  tokenUsage?: TaskTokenUsageDto;

  @ApiPropertyOptional()
  outputText?: string;

  @ApiPropertyOptional()
  providerCommentUrl?: string;
}

export class TaskRepoSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['gitlab', 'github'] })
  provider!: 'gitlab' | 'github';

  @ApiProperty()
  name!: string;

  @ApiProperty()
  enabled!: boolean;
}

export class TaskRobotSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  repoId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['read', 'write'] })
  permission!: 'read' | 'write';

  @ApiProperty()
  enabled!: boolean;
}

export class TaskPermissionsDto {
  @ApiProperty()
  canManage!: boolean;
}

export class TaskQueueDiagnosisDto {
  // Describe queued task diagnosis for the console UI. f3a9c2d8e1b7f4a0c6d1
  @ApiProperty({ enum: ['queue_backlog', 'no_active_worker', 'inline_worker_disabled', 'unknown'] })
  reasonCode!: 'queue_backlog' | 'no_active_worker' | 'inline_worker_disabled' | 'unknown';

  @ApiProperty()
  ahead!: number;

  @ApiProperty()
  queuedTotal!: number;

  @ApiProperty()
  processing!: number;

  @ApiProperty()
  staleProcessing!: number;

  @ApiProperty()
  inlineWorkerEnabled!: boolean;
}

export class TaskWithMetaDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  groupId?: string | null;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ enum: ['queued', 'processing', 'succeeded', 'failed', 'commented'] })
  status!: 'queued' | 'processing' | 'succeeded' | 'failed' | 'commented';

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  archivedAt?: string | null;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  projectId?: number;

  @ApiPropertyOptional({ enum: ['gitlab', 'github'], nullable: true })
  repoProvider?: 'gitlab' | 'github' | null;

  @ApiPropertyOptional({ nullable: true })
  repoId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  robotId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  ref?: string | null;

  @ApiPropertyOptional()
  mrId?: number;

  @ApiPropertyOptional()
  issueId?: number;

  @ApiProperty()
  retries!: number;

  @ApiPropertyOptional({ type: TaskQueueDiagnosisDto })
  queue?: TaskQueueDiagnosisDto;

  @ApiPropertyOptional({ type: TaskResultDto })
  result?: TaskResultDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: TaskRepoSummaryDto })
  repo?: TaskRepoSummaryDto;

  @ApiPropertyOptional({ type: TaskRobotSummaryDto })
  robot?: TaskRobotSummaryDto;

  @ApiPropertyOptional({ type: TaskPermissionsDto })
  permissions?: TaskPermissionsDto;
}

export class ListTasksResponseDto {
  @ApiProperty({ type: TaskWithMetaDto, isArray: true })
  tasks!: TaskWithMetaDto[];
}

export class TaskStatusStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  queued!: number;

  @ApiProperty()
  processing!: number;

  @ApiProperty()
  success!: number;

  @ApiProperty()
  failed!: number;
}

export class TaskStatsResponseDto {
  @ApiProperty({ type: TaskStatusStatsDto })
  stats!: TaskStatusStatsDto;
}

export class GetTaskResponseDto {
  @ApiProperty({ type: TaskWithMetaDto })
  task!: TaskWithMetaDto;
}

export class RetryTaskResponseDto {
  @ApiProperty({ type: TaskWithMetaDto })
  task!: TaskWithMetaDto;
}

export class TaskLogsResponseDto {
  @ApiProperty({ type: String, isArray: true })
  logs!: string[];
}

export class TaskVolumePointDto {
  // Describe daily task volume points for the repo dashboard trend chart. dashtrendline20260119m9v2
  @ApiProperty({ example: '2026-01-19', description: 'UTC day bucket in YYYY-MM-DD format.' })
  day!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class TaskVolumeByDayResponseDto {
  @ApiProperty({ type: TaskVolumePointDto, isArray: true })
  points!: TaskVolumePointDto[];
}
