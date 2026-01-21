import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Define request/response DTOs for model provider model discovery endpoints. b8fucnmey62u0muyn7i0
export class ModelProviderCredentialDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  apiKey?: string | null;
}

export class ModelProviderModelsRequestDto {
  @ApiProperty({ description: 'Model provider key (codex/claude_code/gemini_cli).' })
  @IsString()
  provider!: string;

  @ApiPropertyOptional({ description: 'Credential profile id (when using stored user/repo credentials).' })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiPropertyOptional({ type: ModelProviderCredentialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelProviderCredentialDto)
  credential?: ModelProviderCredentialDto;

  @ApiPropertyOptional({ description: 'Bypass in-memory cache and re-query the provider API.' })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class ModelProviderModelsResponseDto {
  @ApiProperty({ type: String, isArray: true })
  models!: string[];

  @ApiProperty({ enum: ['remote', 'fallback'] })
  source!: 'remote' | 'fallback';
}
