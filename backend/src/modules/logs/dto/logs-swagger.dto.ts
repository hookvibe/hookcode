import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Swagger DTOs for system log APIs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export class SystemLogDto {
  @ApiProperty({ description: 'Log id (UUID).' })
  id!: string;

  @ApiProperty({ enum: ['system', 'operation', 'execution'] })
  category!: 'system' | 'operation' | 'execution';

  @ApiProperty({ enum: ['info', 'warn', 'error'] })
  level!: 'info' | 'warn' | 'error';

  @ApiProperty({ description: 'Human-readable log message.' })
  message!: string;

  @ApiPropertyOptional({ description: 'Stable event code for filtering.' })
  code?: string;

  @ApiPropertyOptional({ description: 'User id of the actor (UUID).', nullable: true })
  actorUserId?: string | null;

  @ApiPropertyOptional({ description: 'Repo id associated with the log.', nullable: true })
  repoId?: string | null;

  @ApiPropertyOptional({ description: 'Task id associated with the log.', nullable: true })
  taskId?: string | null;

  @ApiPropertyOptional({ description: 'Task group id associated with the log.', nullable: true })
  taskGroupId?: string | null;

  @ApiPropertyOptional({ description: 'Structured metadata payload.' })
  meta?: unknown;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ListSystemLogsResponseDto {
  @ApiProperty({ type: [SystemLogDto] })
  logs!: SystemLogDto[];

  @ApiPropertyOptional({ description: 'Pagination cursor for the next page.' })
  nextCursor?: string;
}
