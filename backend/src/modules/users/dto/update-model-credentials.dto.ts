import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ModelProviderCredentialProfileDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  remark?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

class ModelProviderCredentialsUpdateDto {
  @ApiPropertyOptional({ type: ModelProviderCredentialProfileDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelProviderCredentialProfileDto)
  profiles?: ModelProviderCredentialProfileDto[];

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

class RepoProviderCredentialProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ nullable: true })
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
  @ApiPropertyOptional({ type: ModelProviderCredentialsUpdateDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialsUpdateDto)
  codex?: ModelProviderCredentialsUpdateDto | null;

  @ApiPropertyOptional({ type: ModelProviderCredentialsUpdateDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialsUpdateDto)
  claude_code?: ModelProviderCredentialsUpdateDto | null;

  @ApiPropertyOptional({ type: ModelProviderCredentialsUpdateDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialsUpdateDto)
  gemini_cli?: ModelProviderCredentialsUpdateDto | null;

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
