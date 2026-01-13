import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRepoRobotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  token?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  cloneUsername?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  repoCredentialProfileId?: string | null;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelProvider?: string;

  @ApiPropertyOptional({ description: 'Model provider config (shape varies by provider).' })
  @IsOptional()
  @Allow()
  modelProviderConfig?: unknown;
}
