import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ModelProviderCredentialProfilePublicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  remark!: string;

  @ApiPropertyOptional({ nullable: true })
  apiBaseUrl?: string | null;

  @ApiProperty()
  hasApiKey!: boolean;
}

export class ModelProviderCredentialsPublicDto {
  @ApiProperty({ type: ModelProviderCredentialProfilePublicDto, isArray: true })
  profiles!: ModelProviderCredentialProfilePublicDto[];

  @ApiPropertyOptional({ nullable: true })
  defaultProfileId?: string | null;
}

export class RepoProviderCredentialProfilePublicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  remark!: string;

  @ApiProperty()
  hasToken!: boolean;

  @ApiPropertyOptional({ nullable: true })
  cloneUsername?: string | null;
}

export class RepoProviderCredentialsPublicDto {
  @ApiProperty({ type: RepoProviderCredentialProfilePublicDto, isArray: true })
  profiles!: RepoProviderCredentialProfilePublicDto[];

  @ApiPropertyOptional({ nullable: true })
  defaultProfileId?: string | null;
}

export class UserModelCredentialsPublicDto {
  @ApiProperty({ type: ModelProviderCredentialsPublicDto })
  codex!: ModelProviderCredentialsPublicDto;

  @ApiProperty({ type: ModelProviderCredentialsPublicDto })
  claude_code!: ModelProviderCredentialsPublicDto;

  @ApiProperty({ type: ModelProviderCredentialsPublicDto })
  gemini_cli!: ModelProviderCredentialsPublicDto;

  @ApiProperty({ type: RepoProviderCredentialsPublicDto })
  gitlab!: RepoProviderCredentialsPublicDto;

  @ApiProperty({ type: RepoProviderCredentialsPublicDto })
  github!: RepoProviderCredentialsPublicDto;
}

export class ModelCredentialsResponseDto {
  @ApiProperty({ type: UserModelCredentialsPublicDto })
  credentials!: UserModelCredentialsPublicDto;
}
