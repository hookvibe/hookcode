import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

// Validate replay options so admin/repo callers can safely select stored actions, current config, or explicit overrides. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export class ReplayWebhookEventDto {
  @ApiPropertyOptional({ enum: ['stored_actions', 'current_config', 'override_robot', 'override_rule'] })
  @IsOptional()
  @IsIn(['stored_actions', 'current_config', 'override_robot', 'override_rule'])
  mode?: 'stored_actions' | 'current_config' | 'override_robot' | 'override_rule';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  robotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ruleId?: string;
}
