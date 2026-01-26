import { Allow, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TimeWindowDto } from '../../common/dto/time-window.dto';

export class CreateRepoRobotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  token?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Repo provider credential source (robot/user/repo). Required when using credential profiles.'
  })
  @IsOptional()
  @IsString()
  repoCredentialSource?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  cloneUsername?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  repoCredentialProfileId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'User-defined note for per-robot repo tokens.' })
  @IsOptional()
  @IsString()
  repoCredentialRemark?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  defaultBranch?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Legacy branch role (main/dev/test).' })
  @IsOptional()
  @IsString()
  defaultBranchRole?: string | null;

  @ApiPropertyOptional({ description: 'Default prompt template.' })
  @IsOptional()
  @IsString()
  promptDefault?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Robot language (BCP 47 recommended).' })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiPropertyOptional({ description: 'Model provider (default: codex).' })
  @IsOptional()
  @IsString()
  modelProvider?: string;

  @ApiPropertyOptional({ description: 'Model provider config (shape varies by provider).' })
  @IsOptional()
  @Allow()
  modelProviderConfig?: unknown;

  @ApiPropertyOptional({ description: 'Dependency overrides (enabled/failureMode/allowCustomInstall).' })
  @IsOptional()
  @Allow()
  // Accept dependency override payloads for robot creation. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyConfig?: unknown;

  // Accept workflow mode selection for robot creation. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  @ApiPropertyOptional({ nullable: true, description: 'Repo workflow mode (auto/direct/fork).' })
  @IsOptional()
  @IsString()
  repoWorkflowMode?: string | null;

  @ApiPropertyOptional({ description: 'Whether set as default robot for the repo.' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: TimeWindowDto, nullable: true, description: 'Hour-level execution window (server time).' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeWindowDto)
  // Accept robot-level time window configuration at creation. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindowDto | null;
}
