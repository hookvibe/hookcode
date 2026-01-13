import { Allow, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAutomationDto {
  @ApiPropertyOptional({ description: 'Automation config object.' })
  @IsOptional()
  @Allow()
  config?: unknown;
}
