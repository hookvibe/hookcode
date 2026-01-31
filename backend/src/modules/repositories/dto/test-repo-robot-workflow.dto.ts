import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TestRepoRobotWorkflowDto {
  // Accept a requested workflow mode for the check action (auto/direct/fork). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  @ApiPropertyOptional({ nullable: true, description: 'Workflow mode to validate (auto/direct/fork).' })
  @IsOptional()
  @IsString()
  mode?: string | null;
}
