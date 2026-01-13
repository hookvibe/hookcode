import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CodexCredentialsPublicDto {
  @ApiPropertyOptional({ nullable: true })
  apiBaseUrl?: string | null;

  @ApiProperty()
  hasApiKey!: boolean;
}

export class ClaudeCodeCredentialsPublicDto {
  @ApiProperty()
  hasApiKey!: boolean;
}

export class GeminiCliCredentialsPublicDto {
  @ApiProperty()
  hasApiKey!: boolean;
}

export class RepoProviderCredentialProfilePublicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

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
  @ApiProperty({ type: CodexCredentialsPublicDto })
  codex!: CodexCredentialsPublicDto;

  @ApiProperty({ type: ClaudeCodeCredentialsPublicDto })
  claude_code!: ClaudeCodeCredentialsPublicDto;

  @ApiProperty({ type: GeminiCliCredentialsPublicDto })
  gemini_cli!: GeminiCliCredentialsPublicDto;

  @ApiProperty({ type: RepoProviderCredentialsPublicDto })
  gitlab!: RepoProviderCredentialsPublicDto;

  @ApiProperty({ type: RepoProviderCredentialsPublicDto })
  github!: RepoProviderCredentialsPublicDto;
}

export class ModelCredentialsResponseDto {
  @ApiProperty({ type: UserModelCredentialsPublicDto })
  credentials!: UserModelCredentialsPublicDto;
}
