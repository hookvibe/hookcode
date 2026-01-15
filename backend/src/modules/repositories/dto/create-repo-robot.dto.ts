import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'Whether set as default robot for the repo.' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
