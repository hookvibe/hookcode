import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Display name (nullable to clear).', nullable: true })
  @IsOptional()
  @IsString()
  displayName?: string | null;
}
