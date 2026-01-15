import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UpdateRepositoryDto (repos PATCH):
 * - Business context: update repo metadata + repo-scoped credentials in a single API.
 * - Security: tokens/apiKeys are write-only; UI must never display raw secrets.
 *
 * Change record:
 * - 2026-01-14: Refactor repo-scoped credentials to support multiple credential profiles + `remark`.
 */

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

class RepoProviderCredentialProfilePatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  id?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'User-defined note for distinguishing credentials in UI.' })
  @IsOptional()
  @IsString()
  remark?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  token?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  cloneUsername?: string | null;
}

class RepoProviderCredentialsPatchDto {
  @ApiPropertyOptional({ type: RepoProviderCredentialProfilePatchDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepoProviderCredentialProfilePatchDto)
  profiles?: RepoProviderCredentialProfilePatchDto[];

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

class ModelProviderCredentialProfilePatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  id?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'User-defined note for distinguishing credentials in UI.' })
  @IsOptional()
  @IsString()
  remark?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Provider API Base URL (proxy).' })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class ModelProviderCredentialsPatchDto {
  @ApiPropertyOptional({ type: ModelProviderCredentialProfilePatchDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelProviderCredentialProfilePatchDto)
  profiles?: ModelProviderCredentialProfilePatchDto[];

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

class ModelProviderCredentialPatchDto {
  @ApiPropertyOptional({ type: ModelProviderCredentialsPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialsPatchDto)
  codex?: ModelProviderCredentialsPatchDto | null;

  @ApiPropertyOptional({ type: ModelProviderCredentialsPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialsPatchDto)
  claude_code?: ModelProviderCredentialsPatchDto | null;

  @ApiPropertyOptional({ type: ModelProviderCredentialsPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialsPatchDto)
  gemini_cli?: ModelProviderCredentialsPatchDto | null;
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

  @ApiPropertyOptional({ type: RepoProviderCredentialsPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepoProviderCredentialsPatchDto)
  repoProviderCredential?: RepoProviderCredentialsPatchDto | null;

  @ApiPropertyOptional({ type: ModelProviderCredentialPatchDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialPatchDto)
  modelProviderCredential?: ModelProviderCredentialPatchDto | null;
}

