import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TestRepoWorkflowDto {
  // Accept a requested workflow mode for the check action (auto/direct/fork). docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
  @ApiPropertyOptional({ nullable: true, description: 'Workflow mode to validate (auto/direct/fork).' })
  @IsOptional()
  @IsString()
  mode?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Credential source: robot/user/repo.' })
  @IsOptional()
  @IsString()
  repoCredentialSource?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Credential profile id for user/repo sources.' })
  @IsOptional()
  @IsString()
  repoCredentialProfileId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Per-robot token when repoCredentialSource=robot.' })
  @IsOptional()
  @IsString()
  token?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Robot permission used for auto workflow selection (read/write).' })
  @IsOptional()
  @IsString()
  permission?: string | null;
}

