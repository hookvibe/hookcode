import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsIn, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { PAT_SCOPE_GROUPS, PAT_SCOPE_LEVELS, type PatScopeGroup, type PatScopeLevel } from '../../auth/patScopes';

// DTOs for user-scoped PAT API management. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export class ApiTokenScopeDto {
  @ApiProperty({ enum: PAT_SCOPE_GROUPS })
  @IsString()
  @IsIn(PAT_SCOPE_GROUPS)
  group!: PatScopeGroup;

  @ApiProperty({ enum: PAT_SCOPE_LEVELS })
  @IsString()
  @IsIn(PAT_SCOPE_LEVELS)
  level!: PatScopeLevel;
}

export class UserApiTokenDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  tokenPrefix!: string;

  @ApiPropertyOptional()
  tokenLast4?: string | null;

  @ApiProperty({ type: ApiTokenScopeDto, isArray: true })
  scopes!: ApiTokenScopeDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  revokedAt?: string | null;

  @ApiPropertyOptional()
  lastUsedAt?: string | null;
}

export class ListUserApiTokensResponseDto {
  @ApiProperty({ type: UserApiTokenDto, isArray: true })
  tokens!: UserApiTokenDto[];
}

export class CreateUserApiTokenDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ type: ApiTokenScopeDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApiTokenScopeDto)
  scopes!: ApiTokenScopeDto[];

  @ApiPropertyOptional({ description: '0 = never expire' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  expiresInDays?: number | null;
}

export class UpdateUserApiTokenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: ApiTokenScopeDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApiTokenScopeDto)
  scopes?: ApiTokenScopeDto[];

  @ApiPropertyOptional({ description: '0 = never expire' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  expiresInDays?: number | null;
}

export class CreateUserApiTokenResponseDto {
  @ApiProperty()
  token!: string;

  @ApiProperty({ type: UserApiTokenDto })
  apiToken!: UserApiTokenDto;
}

export class UserApiTokenResponseDto {
  @ApiProperty({ type: UserApiTokenDto })
  apiToken!: UserApiTokenDto;
}
