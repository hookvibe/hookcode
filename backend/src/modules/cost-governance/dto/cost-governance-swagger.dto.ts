import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BudgetExceededMetricDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  period!: 'daily' | 'monthly' | 'task';

  @ApiProperty()
  unit!: 'tasks' | 'tokens' | 'usd' | 'seconds' | 'steps';

  @ApiProperty()
  actual!: number;

  @ApiProperty()
  limit!: number;
}

export class BudgetExecutionOverrideDto {
  @ApiPropertyOptional({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  provider?: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiPropertyOptional()
  model?: string;

  @ApiPropertyOptional()
  forceReadOnly?: boolean;

  @ApiPropertyOptional()
  maxRuntimeSeconds?: number;

  @ApiPropertyOptional()
  maxStepCount?: number;
}

export class BudgetPolicyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['user', 'repo', 'robot'] })
  scopeType!: 'user' | 'repo' | 'robot';

  @ApiProperty()
  scopeId!: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ enum: ['hard_limit', 'soft_limit', 'degrade', 'manual_approval'] })
  overageAction!: 'hard_limit' | 'soft_limit' | 'degrade' | 'manual_approval';

  @ApiPropertyOptional()
  dailyTaskCountLimit?: number;

  @ApiPropertyOptional()
  monthlyTaskCountLimit?: number;

  @ApiPropertyOptional()
  dailyTokenLimit?: number;

  @ApiPropertyOptional()
  monthlyTokenLimit?: number;

  @ApiPropertyOptional()
  dailyEstimatedCostUsdLimit?: number;

  @ApiPropertyOptional()
  monthlyEstimatedCostUsdLimit?: number;

  @ApiPropertyOptional()
  maxRuntimeSeconds?: number;

  @ApiPropertyOptional()
  maxStepCount?: number;

  @ApiPropertyOptional({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  degradeProvider?: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiPropertyOptional()
  degradeModel?: string;

  @ApiProperty()
  forceReadOnlyOnOverage!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class QuotaEventDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  budgetPolicyId?: string;

  @ApiPropertyOptional()
  taskId?: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiPropertyOptional()
  robotId?: string;

  @ApiPropertyOptional()
  actorUserId?: string;

  @ApiPropertyOptional({ enum: ['user', 'repo', 'robot'] })
  scopeType?: 'user' | 'repo' | 'robot';

  @ApiPropertyOptional()
  scopeId?: string;

  @ApiProperty({ enum: ['warning', 'blocked', 'approval_required', 'degrade_applied'] })
  eventType!: 'warning' | 'blocked' | 'approval_required' | 'degrade_applied';

  @ApiProperty({ enum: ['allow', 'allow_with_warning', 'require_approval', 'deny', 'degrade'] })
  decision!: 'allow' | 'allow_with_warning' | 'require_approval' | 'deny' | 'degrade';

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  details?: unknown;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class UsageWindowSummaryDto {
  @ApiProperty()
  taskCount!: number;

  @ApiProperty()
  failedTaskCount!: number;

  @ApiProperty()
  blockedTaskCount!: number;

  @ApiProperty()
  inputTokens!: number;

  @ApiProperty()
  outputTokens!: number;

  @ApiProperty()
  totalTokens!: number;

  @ApiProperty()
  estimatedCostUsd!: number;
}

export class UsageSeriesPointDto {
  @ApiProperty()
  bucket!: string;

  @ApiProperty()
  taskCount!: number;

  @ApiProperty()
  failedTaskCount!: number;

  @ApiProperty()
  totalTokens!: number;

  @ApiProperty()
  estimatedCostUsd!: number;
}

export class UsageBreakdownItemDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  taskCount!: number;

  @ApiProperty()
  failedTaskCount!: number;

  @ApiProperty()
  totalTokens!: number;

  @ApiProperty()
  estimatedCostUsd!: number;
}

export class CostTaskItemDto {
  @ApiProperty()
  taskId!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiPropertyOptional()
  repoName?: string;

  @ApiPropertyOptional()
  robotId?: string;

  @ApiPropertyOptional()
  robotName?: string;

  @ApiPropertyOptional()
  actorUserId?: string;

  @ApiPropertyOptional()
  actorUserName?: string;

  @ApiPropertyOptional()
  provider?: string;

  @ApiPropertyOptional()
  model?: string;

  @ApiProperty()
  totalTokens!: number;

  @ApiProperty()
  estimatedCostUsd!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CostSummaryResponseDto {
  @ApiProperty()
  window!: { days: number; startAt: string; endAt: string };

  @ApiProperty({ type: UsageWindowSummaryDto })
  summary!: UsageWindowSummaryDto;

  @ApiProperty({ type: [UsageSeriesPointDto] })
  series!: UsageSeriesPointDto[];

  @ApiProperty({ type: [UsageBreakdownItemDto] })
  providers!: UsageBreakdownItemDto[];

  @ApiProperty({ type: [UsageBreakdownItemDto] })
  topRepos!: UsageBreakdownItemDto[];

  @ApiProperty({ type: [UsageBreakdownItemDto] })
  topRobots!: UsageBreakdownItemDto[];

  @ApiProperty({ type: [UsageBreakdownItemDto] })
  topUsers!: UsageBreakdownItemDto[];

  @ApiProperty({ type: [CostTaskItemDto] })
  topTasks!: CostTaskItemDto[];

  @ApiProperty({ type: [CostTaskItemDto] })
  failedCostTasks!: CostTaskItemDto[];

  @ApiProperty({ type: [QuotaEventDto] })
  recentQuotaEvents!: QuotaEventDto[];
}

export class CostBreakdownResponseDto {
  @ApiProperty()
  window!: { days: number; startAt: string; endAt: string };

  @ApiProperty({ type: [UsageBreakdownItemDto] })
  items!: UsageBreakdownItemDto[];
}

export class BudgetPoliciesResponseDto {
  @ApiProperty({ type: [BudgetPolicyDto] })
  policies!: BudgetPolicyDto[];
}

export class BudgetPolicyResponseDto {
  @ApiProperty({ type: BudgetPolicyDto })
  policy!: BudgetPolicyDto;
}
