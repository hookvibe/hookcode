import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DependencyResultDto } from './tasks-swagger.dto';

export class PreviewLogEntryDto {
  // Preview log entry payload used by diagnostics and log streaming. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  timestamp!: string;

  @ApiProperty({ enum: ['stdout', 'stderr', 'system'] })
  level!: 'stdout' | 'stderr' | 'system';

  @ApiProperty()
  message!: string;
}

export class PreviewDiagnosticsDto {
  // Structured diagnostics included with failed/timeout preview instances. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiPropertyOptional({ nullable: true })
  exitCode?: number | null;

  @ApiPropertyOptional({ nullable: true })
  signal?: string | null;

  @ApiPropertyOptional({ type: () => PreviewLogEntryDto, isArray: true })
  logs?: PreviewLogEntryDto[];
}

export class PreviewInstanceDto {
  // Preview instance status returned by the TaskGroup preview APIs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['stopped', 'starting', 'running', 'failed', 'timeout'] })
  status!: 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

  @ApiPropertyOptional()
  port?: number;

  @ApiPropertyOptional()
  path?: string;

  @ApiPropertyOptional()
  message?: string;

  // Attach diagnostics for failed preview instances in Phase 3. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiPropertyOptional({
    type: () => PreviewDiagnosticsDto
  })
  diagnostics?: PreviewDiagnosticsDto;
}

export class PreviewStatusResponseDto {
  // Response payload for preview status checks. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  available!: boolean;

  @ApiProperty({ type: PreviewInstanceDto, isArray: true })
  instances!: PreviewInstanceDto[];

  @ApiPropertyOptional({ enum: ['config_missing', 'config_invalid', 'workspace_missing', 'invalid_group', 'missing_task'] })
  reason?: 'config_missing' | 'config_invalid' | 'workspace_missing' | 'invalid_group' | 'missing_task';
}

export class PreviewStartResponseDto {
  // Start preview response payload. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: PreviewInstanceDto, isArray: true })
  instances!: PreviewInstanceDto[];
}

export class PreviewStopResponseDto {
  // Stop preview response payload. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  success!: boolean;
}

export class PreviewDependencyInstallResponseDto {
  // Preview dependency install response payload for manual reinstall. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: DependencyResultDto })
  result!: DependencyResultDto;
}
