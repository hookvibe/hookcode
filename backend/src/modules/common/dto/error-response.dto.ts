import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ description: 'Error summary.' })
  error!: string;

  @ApiPropertyOptional({ description: 'Error details (optional).' })
  message?: string;

  @ApiPropertyOptional({ description: 'Machine-readable error code (optional).' })
  code?: string;

  @ApiPropertyOptional({ description: 'Failure reason (optional).' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional error details (optional).' })
  details?: unknown;
}

