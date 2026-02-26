import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Verify-email payload for token-based confirmation. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export class VerifyEmailDto {
  @ApiPropertyOptional({ description: 'Email.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  email?: string;

  @ApiPropertyOptional({ description: 'Verification token.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  token?: string;
}
