import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Describe repo preview config responses for the preview-config endpoint. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as

export class RepoPreviewInstanceDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  workdir!: string;
}

export class RepoPreviewConfigResponseDto {
  @ApiProperty()
  available!: boolean;

  @ApiPropertyOptional({ enum: ['no_workspace', 'config_missing', 'config_invalid', 'workspace_missing'] })
  reason?: 'no_workspace' | 'config_missing' | 'config_invalid' | 'workspace_missing';

  @ApiProperty({ type: RepoPreviewInstanceDto, isArray: true })
  instances!: RepoPreviewInstanceDto[];
}
