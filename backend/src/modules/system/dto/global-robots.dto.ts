import { Allow, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TimeWindowDto } from '../../common/dto/time-window.dto';
import type { RobotDependencyConfig } from '../../../types/dependency';
import type { RobotDefaultBranchRole } from '../../../types/repoRobot';

// Describe admin-managed global robot mutation payloads so system APIs keep Swagger and ValidationPipe behavior aligned. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
export class CreateGlobalRobotDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Compatibility field accepted from the admin form; effective permission is derived from model config.' })
  @IsOptional()
  @IsString()
  permission?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Repo provider credential source (global/user/repo) used by shared robots.'
  })
  @IsOptional()
  @IsString()
  repoCredentialSource?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  repoCredentialProfileId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Default execution worker id for tasks created by this global robot.' })
  @IsOptional()
  @IsString()
  defaultWorkerId?: string | null;

  @ApiProperty({ description: 'Default prompt template.' })
  @IsString()
  promptDefault!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Robot language (BCP 47 recommended).' })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiPropertyOptional({ description: 'Model provider (default: codex).' })
  @IsOptional()
  @IsString()
  modelProvider?: string | null;

  @ApiPropertyOptional({ description: 'Model provider config (shape varies by provider).' })
  @IsOptional()
  @Allow()
  modelProviderConfig?: unknown;

  @ApiPropertyOptional({ description: 'Dependency overrides (enabled/failureMode/allowCustomInstall).' })
  @IsOptional()
  @Allow()
  dependencyConfig?: RobotDependencyConfig | null;

  @ApiPropertyOptional({ nullable: true, description: 'Default branch name for shared robot runs.' })
  @IsOptional()
  @IsString()
  defaultBranch?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Legacy branch role (main/dev/test).' })
  @IsOptional()
  @IsIn(['main', 'dev', 'test'])
  defaultBranchRole?: RobotDefaultBranchRole | null;

  @ApiPropertyOptional({ nullable: true, description: 'Repo workflow mode (auto/direct/fork).' })
  @IsOptional()
  @IsIn(['auto', 'direct', 'fork'])
  repoWorkflowMode?: 'auto' | 'direct' | 'fork' | null;

  @ApiPropertyOptional({ type: TimeWindowDto, nullable: true, description: 'Hour-level execution window (server time).' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeWindowDto)
  timeWindow?: TimeWindowDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

// Keep global robot patch payloads aligned with create semantics so partial updates preserve whitelist validation. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
export class UpdateGlobalRobotDto extends PartialType(CreateGlobalRobotDto) {}
