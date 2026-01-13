import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  db!: 'up' | 'down';

  @ApiProperty({ format: 'date-time' })
  time!: string;
}

