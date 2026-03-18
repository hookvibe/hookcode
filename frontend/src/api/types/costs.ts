import type { ModelProvider } from './models';

export type CostScope = 'me' | 'repo' | 'global';
export type BudgetScopeType = 'user' | 'repo' | 'robot';
export type BudgetOverageAction = 'hard_limit' | 'soft_limit' | 'degrade' | 'manual_approval';
export type BudgetQuotaEventType = 'warning' | 'blocked' | 'approval_required' | 'degrade_applied';
export type BudgetDecision = 'allow' | 'allow_with_warning' | 'require_approval' | 'deny' | 'degrade';

export interface UsageWindow {
  days: number;
  startAt: string;
  endAt: string;
}

export interface UsageWindowSummary {
  taskCount: number;
  failedTaskCount: number;
  blockedTaskCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageSeriesPoint {
  bucket: string;
  taskCount: number;
  failedTaskCount: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageBreakdownItem {
  key: string;
  label: string;
  taskCount: number;
  failedTaskCount: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface CostTaskItem {
  taskId: string;
  title?: string;
  status: string;
  repoId?: string;
  repoName?: string;
  robotId?: string;
  robotName?: string;
  actorUserId?: string;
  actorUserName?: string;
  provider?: string;
  model?: string;
  totalTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface QuotaEvent {
  id: string;
  budgetPolicyId?: string;
  taskId?: string;
  repoId?: string;
  robotId?: string;
  actorUserId?: string;
  scopeType?: BudgetScopeType;
  scopeId?: string;
  eventType: BudgetQuotaEventType;
  decision: BudgetDecision;
  message: string;
  details?: unknown;
  createdAt: string;
}

export interface CostSummaryResponse {
  window: UsageWindow;
  summary: UsageWindowSummary;
  series: UsageSeriesPoint[];
  providers: UsageBreakdownItem[];
  topRepos: UsageBreakdownItem[];
  topRobots: UsageBreakdownItem[];
  topUsers: UsageBreakdownItem[];
  topTasks: CostTaskItem[];
  failedCostTasks: CostTaskItem[];
  recentQuotaEvents: QuotaEvent[];
}

export interface CostBreakdownResponse {
  window: UsageWindow;
  items: UsageBreakdownItem[];
}

export interface BudgetPolicy {
  id: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  name?: string;
  enabled: boolean;
  overageAction: BudgetOverageAction;
  dailyTaskCountLimit?: number;
  monthlyTaskCountLimit?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  dailyEstimatedCostUsdLimit?: number;
  monthlyEstimatedCostUsdLimit?: number;
  maxRuntimeSeconds?: number;
  maxStepCount?: number;
  degradeProvider?: ModelProvider;
  degradeModel?: string;
  forceReadOnlyOnOverage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetPoliciesResponse {
  policies: BudgetPolicy[];
}

export interface BudgetPolicyResponse {
  policy: BudgetPolicy;
}

export interface CostSummaryQuery {
  days?: number;
  scope?: CostScope;
  repoId?: string;
  robotId?: string;
}

export interface CostBreakdownQuery {
  days?: number;
  scope?: CostScope;
  repoId?: string;
}

export interface BudgetPolicyQuery {
  scopeType?: BudgetScopeType;
  scopeId?: string;
}

export interface UpdateBudgetPolicyRequest {
  scopeType: BudgetScopeType;
  scopeId?: string;
  name?: string | null;
  enabled?: boolean;
  overageAction?: BudgetOverageAction;
  dailyTaskCountLimit?: number | null;
  monthlyTaskCountLimit?: number | null;
  dailyTokenLimit?: number | null;
  monthlyTokenLimit?: number | null;
  dailyEstimatedCostUsdLimit?: number | null;
  monthlyEstimatedCostUsdLimit?: number | null;
  maxRuntimeSeconds?: number | null;
  maxStepCount?: number | null;
  degradeProvider?: ModelProvider | null;
  degradeModel?: string | null;
  forceReadOnlyOnOverage?: boolean;
}
