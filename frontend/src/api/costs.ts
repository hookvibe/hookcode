import { api, getCached, invalidateGetCache } from './client';
import type {
  BudgetPoliciesResponse,
  BudgetPolicyQuery,
  BudgetPolicyResponse,
  CostBreakdownQuery,
  CostBreakdownResponse,
  CostSummaryQuery,
  CostSummaryResponse,
  UpdateBudgetPolicyRequest
} from './types';

const COSTS_CACHE_TTL_MS = 10_000;

export const fetchCostSummary = async (params?: CostSummaryQuery): Promise<CostSummaryResponse> => {
  return getCached<CostSummaryResponse>('/costs/summary', { params, cacheTtlMs: COSTS_CACHE_TTL_MS });
};

export const fetchCostBreakdownByRepo = async (params?: CostBreakdownQuery): Promise<CostBreakdownResponse> => {
  return getCached<CostBreakdownResponse>('/costs/by-repo', { params, cacheTtlMs: COSTS_CACHE_TTL_MS });
};

export const fetchCostBreakdownByRobot = async (params?: CostBreakdownQuery): Promise<CostBreakdownResponse> => {
  return getCached<CostBreakdownResponse>('/costs/by-robot', { params, cacheTtlMs: COSTS_CACHE_TTL_MS });
};

export const fetchBudgetPolicies = async (params?: BudgetPolicyQuery): Promise<BudgetPoliciesResponse> => {
  return getCached<BudgetPoliciesResponse>('/budgets', { params, cacheTtlMs: COSTS_CACHE_TTL_MS });
};

export const patchBudgetPolicy = async (params: UpdateBudgetPolicyRequest): Promise<BudgetPolicyResponse> => {
  const { data } = await api.patch<BudgetPolicyResponse>('/budgets', params);
  invalidateGetCache('/budgets');
  invalidateGetCache('/costs');
  return data;
};
