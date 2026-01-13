import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({ description: 'Username.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username?: string;

  @ApiPropertyOptional({ description: 'Password.' })
  @IsOptional()
  @IsString()
  password?: string;
}
