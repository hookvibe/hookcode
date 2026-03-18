import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class RepoRobotDryRunSimulationDto {
  @ApiPropertyOptional({ enum: ['manual_chat', 'issue', 'merge_request', 'push', 'custom'] })
  @IsOptional()
  @IsString()
  type?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string | null;

  @ApiPropertyOptional({ description: 'Issue/MR number when the simulation type needs one.' })
  @IsOptional()
  number?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branch?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sha?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceBranch?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetBranch?: string | null;

  @ApiPropertyOptional({ description: 'Custom payload object for `type=custom`.' })
  @IsOptional()
  payload?: unknown;

  @ApiPropertyOptional({ description: 'Synthetic task eventType for `type=custom`.' })
  @IsOptional()
  @IsString()
  eventType?: string | null;
}

class RepoRobotDryRunDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promptDefault?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiPropertyOptional({ enum: ['read', 'write'] })
  @IsOptional()
  @IsString()
  permission?: string | null;

  @ApiPropertyOptional({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  @IsOptional()
  @IsString()
  modelProvider?: string | null;

  @ApiPropertyOptional({ description: 'Draft model provider config from the robot editor.' })
  @IsOptional()
  @IsObject()
  modelProviderConfig?: Record<string, unknown>;
}

export class RepoRobotDryRunDto {
  // Accept both prompt preview and isolated model execution in one robot playground endpoint. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
  @ApiPropertyOptional({ enum: ['render_only', 'execute_no_side_effect'] })
  @IsOptional()
  @IsString()
  @IsIn(['render_only', 'execute_no_side_effect'])
  mode?: 'render_only' | 'execute_no_side_effect' | null;

  @ApiPropertyOptional({ type: RepoRobotDryRunSimulationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepoRobotDryRunSimulationDto)
  simulation?: RepoRobotDryRunSimulationDto | null;

  @ApiPropertyOptional({ type: RepoRobotDryRunDraftDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepoRobotDryRunDraftDto)
  draft?: RepoRobotDryRunDraftDto | null;
}
