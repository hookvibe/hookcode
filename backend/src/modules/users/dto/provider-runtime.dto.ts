import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Describe the public DTO returned by the local provider runtime-status endpoint. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
export class ProviderRuntimeStatusDto {
  @ApiProperty({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  provider!: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiProperty()
  authenticated!: boolean;

  @ApiPropertyOptional({ enum: ['env_api_key', 'credentials_file', 'auth_json_tokens', 'auth_json_api_key', 'oauth_creds', 'none'] })
  method?: string;

  @ApiPropertyOptional()
  displayName?: string;

  @ApiProperty()
  supportsModelListing!: boolean;

  @ApiProperty()
  hasApiKey!: boolean;
}

export class ProviderRuntimeStatusMapDto {
  @ApiProperty({ type: ProviderRuntimeStatusDto })
  codex!: ProviderRuntimeStatusDto;

  @ApiProperty({ type: ProviderRuntimeStatusDto })
  claude_code!: ProviderRuntimeStatusDto;

  @ApiProperty({ type: ProviderRuntimeStatusDto })
  gemini_cli!: ProviderRuntimeStatusDto;
}

export class ProviderRuntimeStatusesResponseDto {
  @ApiProperty({ type: String, isArray: true })
  precedence!: string[];

  @ApiProperty({ type: ProviderRuntimeStatusMapDto })
  providers!: ProviderRuntimeStatusMapDto;
}
