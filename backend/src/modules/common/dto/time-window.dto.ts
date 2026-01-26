import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class TimeWindowDto {
  // Validate hour-level scheduling windows for API requests. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  @ApiProperty({ minimum: 0, maximum: 23, example: 2 })
  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @ApiProperty({ minimum: 0, maximum: 23, example: 4 })
  @IsInt()
  @Min(0)
  @Max(23)
  endHour!: number;
}
