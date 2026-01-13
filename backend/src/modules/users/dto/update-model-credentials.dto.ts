import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class CodexCredentialsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class ClaudeCodeCredentialsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class GeminiCliCredentialsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class RepoProviderCredentialProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  token?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  cloneUsername?: string | null;
}

class RepoProviderCredentialsUpdateDto {
  @ApiPropertyOptional({ type: RepoProviderCredentialProfileDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepoProviderCredentialProfileDto)
  profiles?: RepoProviderCredentialProfileDto[];

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removeProfileIds?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  defaultProfileId?: string | null;
}

export class UpdateModelCredentialsDto {
  @ApiPropertyOptional({ type: CodexCredentialsDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodexCredentialsDto)
  codex?: CodexCredentialsDto | null;

  @ApiPropertyOptional({ type: ClaudeCodeCredentialsDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClaudeCodeCredentialsDto)
  claude_code?: ClaudeCodeCredentialsDto | null;

  @ApiPropertyOptional({ type: GeminiCliCredentialsDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeminiCliCredentialsDto)
  gemini_cli?: GeminiCliCredentialsDto | null;

  @ApiPropertyOptional({ type: RepoProviderCredentialsUpdateDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepoProviderCredentialsUpdateDto)
  gitlab?: RepoProviderCredentialsUpdateDto | null;

  @ApiPropertyOptional({ type: RepoProviderCredentialsUpdateDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepoProviderCredentialsUpdateDto)
  github?: RepoProviderCredentialsUpdateDto | null;
}
