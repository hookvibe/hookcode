import type { RoutedProviderKey } from '../providerRouting/providerRouting.types';

export const BUDGET_SCOPE_TYPES = ['user', 'repo', 'robot'] as const;
export type BudgetScopeType = (typeof BUDGET_SCOPE_TYPES)[number];

export const BUDGET_POLICY_MODES = ['hard_limit', 'soft_limit', 'degrade', 'manual_approval'] as const;
export type BudgetPolicyMode = (typeof BUDGET_POLICY_MODES)[number];

export const BUDGET_GOVERNANCE_DECISIONS = ['allow', 'allow_with_warning', 'require_approval', 'deny', 'degrade'] as const;
export type BudgetGovernanceDecision = (typeof BUDGET_GOVERNANCE_DECISIONS)[number];

export const BUDGET_QUOTA_EVENT_TYPES = ['warning', 'blocked', 'approval_required', 'degrade_applied'] as const;
export type BudgetQuotaEventType = (typeof BUDGET_QUOTA_EVENT_TYPES)[number];

export const BUDGET_METRIC_KEYS = [
  'daily_task_count',
  'monthly_task_count',
  'daily_tokens',
  'monthly_tokens',
  'daily_cost_usd',
  'monthly_cost_usd',
  'max_runtime_seconds',
  'max_step_count'
] as const;
export type BudgetMetricKey = (typeof BUDGET_METRIC_KEYS)[number];

export type BudgetMetricUnit = 'tasks' | 'tokens' | 'usd' | 'seconds' | 'steps';
export type BudgetMetricPeriod = 'daily' | 'monthly' | 'task';

export interface BudgetPolicyRecord {
  id: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  name?: string;
  enabled: boolean;
  overageAction: BudgetPolicyMode;
  dailyTaskCountLimit?: number;
  monthlyTaskCountLimit?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  dailyEstimatedCostUsdLimit?: number;
  monthlyEstimatedCostUsdLimit?: number;
  maxRuntimeSeconds?: number;
  maxStepCount?: number;
  degradeProvider?: RoutedProviderKey;
  degradeModel?: string;
  forceReadOnlyOnOverage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetUsageSnapshot {
  taskCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicroUsd: bigint;
}

export interface BudgetExceededMetric {
  key: BudgetMetricKey;
  period: BudgetMetricPeriod;
  unit: BudgetMetricUnit;
  actual: number;
  limit: number;
}

export interface BudgetExecutionOverride {
  provider?: RoutedProviderKey;
  model?: string;
  forceReadOnly?: boolean;
  maxRuntimeSeconds?: number;
  maxStepCount?: number;
}

export interface BudgetGovernanceResult {
  decision: BudgetGovernanceDecision;
  policyMode?: BudgetPolicyMode;
  summary?: string;
  matchedPolicyId?: string;
  matchedPolicyName?: string;
  matchedScopeType?: BudgetScopeType;
  matchedScopeId?: string;
  exceeded: BudgetExceededMetric[];
  warnings: string[];
  executionOverride?: BudgetExecutionOverride;
  evaluatedAt: string;
}

export interface QuotaEventRecord {
  id: string;
  budgetPolicyId?: string;
  taskId?: string;
  repoId?: string;
  robotId?: string;
  actorUserId?: string;
  scopeType?: BudgetScopeType;
  scopeId?: string;
  eventType: BudgetQuotaEventType;
  decision: BudgetGovernanceDecision;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
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

export interface CostSummaryResponse {
  window: {
    days: number;
    startAt: string;
    endAt: string;
  };
  summary: UsageWindowSummary;
  series: UsageSeriesPoint[];
  providers: UsageBreakdownItem[];
  topRepos: UsageBreakdownItem[];
  topRobots: UsageBreakdownItem[];
  topUsers: UsageBreakdownItem[];
  topTasks: CostTaskItem[];
  failedCostTasks: CostTaskItem[];
  recentQuotaEvents: QuotaEventRecord[];
}

export interface CostBreakdownResponse {
  window: {
    days: number;
    startAt: string;
    endAt: string;
  };
  items: UsageBreakdownItem[];
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const normalizeBudgetScopeType = (value: unknown): BudgetScopeType | undefined => {
  const raw = safeTrim(value).toLowerCase();
  return (BUDGET_SCOPE_TYPES as readonly string[]).includes(raw) ? (raw as BudgetScopeType) : undefined;
};

export const normalizeBudgetPolicyMode = (value: unknown): BudgetPolicyMode => {
  const raw = safeTrim(value).toLowerCase();
  if ((BUDGET_POLICY_MODES as readonly string[]).includes(raw)) return raw as BudgetPolicyMode;
  return 'soft_limit';
};

export const normalizeBudgetQuotaEventType = (value: unknown): BudgetQuotaEventType => {
  const raw = safeTrim(value).toLowerCase();
  if ((BUDGET_QUOTA_EVENT_TYPES as readonly string[]).includes(raw)) return raw as BudgetQuotaEventType;
  return 'warning';
};

export const normalizeBudgetGovernanceDecision = (value: unknown): BudgetGovernanceDecision => {
  const raw = safeTrim(value).toLowerCase();
  if ((BUDGET_GOVERNANCE_DECISIONS as readonly string[]).includes(raw)) return raw as BudgetGovernanceDecision;
  return 'allow';
};

export const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
};

export const toSafeInt = (value: unknown): number | undefined => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return undefined;
  const normalized = Math.floor(num);
  return normalized >= 0 ? normalized : undefined;
};

export const usdToMicroUsd = (value: unknown): bigint | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return BigInt(Math.round(num * 1_000_000));
};

export const microUsdToUsd = (value: bigint | number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  try {
    const micro =
      typeof value === 'bigint'
        ? Number(value)
        : typeof value === 'number'
          ? value
          : Number(String(value).trim());
    if (!Number.isFinite(micro)) return undefined;
    return Math.round((micro / 1_000_000) * 1_000_000) / 1_000_000;
  } catch {
    return undefined;
  }
};

export const normalizeBudgetExecutionOverride = (value: unknown): BudgetExecutionOverride | undefined => {
  if (!isRecord(value)) return undefined;
  const providerRaw = safeTrim(value.provider).toLowerCase();
  const provider =
    providerRaw === 'codex' || providerRaw === 'claude_code' || providerRaw === 'gemini_cli'
      ? (providerRaw as RoutedProviderKey)
      : undefined;
  const model = safeTrim(value.model) || undefined;
  const forceReadOnly = typeof value.forceReadOnly === 'boolean' ? value.forceReadOnly : undefined;
  const maxRuntimeSeconds = toSafeInt(value.maxRuntimeSeconds);
  const maxStepCount = toSafeInt(value.maxStepCount);
  if (!provider && !model && forceReadOnly === undefined && maxRuntimeSeconds === undefined && maxStepCount === undefined) {
    return undefined;
  }
  return {
    provider,
    model,
    forceReadOnly,
    maxRuntimeSeconds,
    maxStepCount
  };
};
