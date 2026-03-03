import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Describe repo preview config responses for the preview-config endpoint. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as

export class RepoPreviewInstanceDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  workdir!: string;
}

// Describe active preview instances for repo-level preview management cards. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export class RepoPreviewActiveInstanceDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['stopped', 'starting', 'running', 'failed', 'timeout'] })
  status!: 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

  @ApiPropertyOptional()
  port?: number;
}

// Describe active preview task groups returned by the repo preview config endpoint. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export class RepoPreviewActiveTaskGroupDto {
  @ApiProperty()
  taskGroupId!: string;

  @ApiPropertyOptional()
  taskGroupTitle?: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiProperty({ enum: ['stopped', 'starting', 'running', 'failed', 'timeout'] })
  aggregateStatus!: 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

  @ApiProperty({ type: RepoPreviewActiveInstanceDto, isArray: true })
  instances!: RepoPreviewActiveInstanceDto[];
}

export class RepoPreviewConfigResponseDto {
  @ApiProperty()
  available!: boolean;

  @ApiPropertyOptional({ enum: ['no_workspace', 'config_missing', 'config_invalid', 'workspace_missing'] })
  reason?: 'no_workspace' | 'config_missing' | 'config_invalid' | 'workspace_missing';

  @ApiProperty({ type: RepoPreviewInstanceDto, isArray: true })
  instances!: RepoPreviewInstanceDto[];

  @ApiProperty({ type: RepoPreviewActiveTaskGroupDto, isArray: true })
  activeTaskGroups!: RepoPreviewActiveTaskGroupDto[];
}
