import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class RepositoryBranchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class RepoProviderCredentialPatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  token?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  cloneUsername?: string | null;
}

class CodexModelCredentialPatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class ClaudeCodeModelCredentialPatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class GeminiCliModelCredentialPatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class ModelProviderCredentialPatchDto {
  @ApiPropertyOptional({ type: CodexModelCredentialPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodexModelCredentialPatchDto)
  codex?: CodexModelCredentialPatchDto | null;

  @ApiPropertyOptional({ type: ClaudeCodeModelCredentialPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClaudeCodeModelCredentialPatchDto)
  claude_code?: ClaudeCodeModelCredentialPatchDto | null;

  @ApiPropertyOptional({ type: GeminiCliModelCredentialPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeminiCliModelCredentialPatchDto)
  gemini_cli?: GeminiCliModelCredentialPatchDto | null;
}

export class UpdateRepositoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  externalId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({ type: RepositoryBranchDto, isArray: true, nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepositoryBranchDto)
  branches?: RepositoryBranchDto[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  webhookSecret?: string | null;

  @ApiPropertyOptional({ type: RepoProviderCredentialPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepoProviderCredentialPatchDto)
  repoProviderCredential?: RepoProviderCredentialPatchDto | null;

  @ApiPropertyOptional({ type: ModelProviderCredentialPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialPatchDto)
  modelProviderCredential?: ModelProviderCredentialPatchDto | null;
}
