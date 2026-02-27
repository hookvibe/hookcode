import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

// Registration payload for email-based signup. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export class RegisterDto {
  @ApiPropertyOptional({ description: 'Username.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username?: string;

  @ApiPropertyOptional({ description: 'Email.' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  email?: string;

  @ApiPropertyOptional({ description: 'Password.' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Display name (optional).' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName?: string;
}
