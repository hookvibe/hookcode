import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../db';
import {
  type BudgetGovernanceDecision,
  type BudgetPolicyMode,
  type BudgetPolicyRecord,
  type BudgetQuotaEventType,
  type BudgetScopeType,
  type QuotaEventRecord,
  microUsdToUsd,
  normalizeBudgetGovernanceDecision,
  normalizeBudgetPolicyMode,
  normalizeBudgetQuotaEventType,
  normalizeBudgetScopeType,
  toIso,
  toSafeInt,
  usdToMicroUsd
} from './types';

const normalizeOptionalUuid = (value: unknown): string | undefined => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || undefined;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || undefined;
};

const toBudgetPolicyRecord = (row: any): BudgetPolicyRecord => ({
  id: String(row.id),
  scopeType: normalizeBudgetScopeType(row.scopeType ?? row.scope_type) ?? 'user',
  scopeId: String(row.scopeId ?? row.scope_id),
  createdByUserId: normalizeOptionalUuid(row.createdByUserId ?? row.created_by_user_id),
  updatedByUserId: normalizeOptionalUuid(row.updatedByUserId ?? row.updated_by_user_id),
  name: normalizeOptionalString(row.name),
  enabled: Boolean(row.enabled),
  overageAction: normalizeBudgetPolicyMode(row.overageAction ?? row.overage_action),
  dailyTaskCountLimit: toSafeInt(row.dailyTaskCountLimit ?? row.daily_task_count_limit),
  monthlyTaskCountLimit: toSafeInt(row.monthlyTaskCountLimit ?? row.monthly_task_count_limit),
  dailyTokenLimit: toSafeInt(row.dailyTokenLimit ?? row.daily_token_limit),
  monthlyTokenLimit: toSafeInt(row.monthlyTokenLimit ?? row.monthly_token_limit),
  dailyEstimatedCostUsdLimit: microUsdToUsd(row.dailyEstimatedCostMicroUsd ?? row.daily_estimated_cost_micro_usd),
  monthlyEstimatedCostUsdLimit: microUsdToUsd(row.monthlyEstimatedCostMicroUsd ?? row.monthly_estimated_cost_micro_usd),
  maxRuntimeSeconds: toSafeInt(row.maxRuntimeSeconds ?? row.max_runtime_seconds),
  maxStepCount: toSafeInt(row.maxStepCount ?? row.max_step_count),
  degradeProvider: normalizeOptionalString(row.degradeProvider ?? row.degrade_provider) as any,
  degradeModel: normalizeOptionalString(row.degradeModel ?? row.degrade_model),
  forceReadOnlyOnOverage: Boolean(row.forceReadOnlyOnOverage ?? row.force_read_only_on_overage),
  createdAt: toIso(row.createdAt ?? row.created_at),
  updatedAt: toIso(row.updatedAt ?? row.updated_at)
});

const toQuotaEventRecord = (row: any): QuotaEventRecord => ({
  id: String(row.id),
  budgetPolicyId: normalizeOptionalUuid(row.budgetPolicyId ?? row.budget_policy_id),
  taskId: normalizeOptionalUuid(row.taskId ?? row.task_id),
  repoId: normalizeOptionalUuid(row.repoId ?? row.repo_id),
  robotId: normalizeOptionalUuid(row.robotId ?? row.robot_id),
  actorUserId: normalizeOptionalUuid(row.actorUserId ?? row.actor_user_id),
  scopeType: normalizeBudgetScopeType(row.scopeType ?? row.scope_type),
  scopeId: normalizeOptionalUuid(row.scopeId ?? row.scope_id),
  eventType: normalizeBudgetQuotaEventType(row.eventType ?? row.event_type),
  decision: normalizeBudgetGovernanceDecision(row.decision),
  message: String(row.message ?? ''),
  details: row.details ?? row.details_json ?? undefined,
  createdAt: toIso(row.createdAt ?? row.created_at)
});

export interface UpsertBudgetPolicyInput {
  scopeType: BudgetScopeType;
  scopeId: string;
  actorUserId?: string;
  name?: string | null;
  enabled?: boolean;
  overageAction?: BudgetPolicyMode;
  dailyTaskCountLimit?: number | null;
  monthlyTaskCountLimit?: number | null;
  dailyTokenLimit?: number | null;
  monthlyTokenLimit?: number | null;
  dailyEstimatedCostUsdLimit?: number | null;
  monthlyEstimatedCostUsdLimit?: number | null;
  maxRuntimeSeconds?: number | null;
  maxStepCount?: number | null;
  degradeProvider?: string | null;
  degradeModel?: string | null;
  forceReadOnlyOnOverage?: boolean;
}

@Injectable()
export class BudgetService {
  async getPolicy(scopeType: BudgetScopeType, scopeId: string): Promise<BudgetPolicyRecord | null> {
    const row = await db.budgetPolicy.findUnique({
      where: {
        scopeType_scopeId: {
          scopeType,
          scopeId
        }
      }
    });
    return row ? toBudgetPolicyRecord(row) : null;
  }

  async listPolicies(filters?: {
    scopeType?: BudgetScopeType;
    scopeId?: string;
    enabled?: boolean;
  }): Promise<BudgetPolicyRecord[]> {
    const rows = await db.budgetPolicy.findMany({
      where: {
        ...(filters?.scopeType ? { scopeType: filters.scopeType } : {}),
        ...(filters?.scopeId ? { scopeId: filters.scopeId } : {}),
        ...(typeof filters?.enabled === 'boolean' ? { enabled: filters.enabled } : {})
      },
      orderBy: [{ scopeType: 'asc' }, { updatedAt: 'desc' }]
    });
    return rows.map(toBudgetPolicyRecord);
  }

  async listApplicablePolicies(task: {
    repoId?: string;
    robotId?: string;
    actorUserId?: string;
  }): Promise<BudgetPolicyRecord[]> {
    const or: Array<Record<string, unknown>> = [];
    if (task.actorUserId) or.push({ scopeType: 'user', scopeId: task.actorUserId });
    if (task.repoId) or.push({ scopeType: 'repo', scopeId: task.repoId });
    if (task.robotId) or.push({ scopeType: 'robot', scopeId: task.robotId });
    if (!or.length) return [];

    const rows = await db.budgetPolicy.findMany({
      where: {
        enabled: true,
        OR: or as any
      },
      orderBy: [{ scopeType: 'asc' }, { updatedAt: 'desc' }]
    });
    return rows.map(toBudgetPolicyRecord);
  }

  async upsertPolicy(input: UpsertBudgetPolicyInput): Promise<BudgetPolicyRecord> {
    const now = new Date();
    const row = await db.budgetPolicy.upsert({
      where: {
        scopeType_scopeId: {
          scopeType: input.scopeType,
          scopeId: input.scopeId
        }
      },
      create: {
        id: randomUUID(),
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        createdByUserId: input.actorUserId ?? null,
        updatedByUserId: input.actorUserId ?? null,
        name: normalizeOptionalString(input.name) ?? null,
        enabled: input.enabled ?? true,
        overageAction: normalizeBudgetPolicyMode(input.overageAction),
        dailyTaskCountLimit: toSafeInt(input.dailyTaskCountLimit ?? undefined) ?? null,
        monthlyTaskCountLimit: toSafeInt(input.monthlyTaskCountLimit ?? undefined) ?? null,
        dailyTokenLimit: toSafeInt(input.dailyTokenLimit ?? undefined) ?? null,
        monthlyTokenLimit: toSafeInt(input.monthlyTokenLimit ?? undefined) ?? null,
        dailyEstimatedCostMicroUsd: usdToMicroUsd(input.dailyEstimatedCostUsdLimit ?? undefined) ?? null,
        monthlyEstimatedCostMicroUsd: usdToMicroUsd(input.monthlyEstimatedCostUsdLimit ?? undefined) ?? null,
        maxRuntimeSeconds: toSafeInt(input.maxRuntimeSeconds ?? undefined) ?? null,
        maxStepCount: toSafeInt(input.maxStepCount ?? undefined) ?? null,
        degradeProvider: normalizeOptionalString(input.degradeProvider) ?? null,
        degradeModel: normalizeOptionalString(input.degradeModel) ?? null,
        forceReadOnlyOnOverage: Boolean(input.forceReadOnlyOnOverage),
        createdAt: now,
        updatedAt: now
      },
      update: {
        updatedByUserId: input.actorUserId ?? null,
        name: normalizeOptionalString(input.name) ?? null,
        enabled: input.enabled ?? true,
        overageAction: normalizeBudgetPolicyMode(input.overageAction),
        dailyTaskCountLimit: toSafeInt(input.dailyTaskCountLimit ?? undefined) ?? null,
        monthlyTaskCountLimit: toSafeInt(input.monthlyTaskCountLimit ?? undefined) ?? null,
        dailyTokenLimit: toSafeInt(input.dailyTokenLimit ?? undefined) ?? null,
        monthlyTokenLimit: toSafeInt(input.monthlyTokenLimit ?? undefined) ?? null,
        dailyEstimatedCostMicroUsd: usdToMicroUsd(input.dailyEstimatedCostUsdLimit ?? undefined) ?? null,
        monthlyEstimatedCostMicroUsd: usdToMicroUsd(input.monthlyEstimatedCostUsdLimit ?? undefined) ?? null,
        maxRuntimeSeconds: toSafeInt(input.maxRuntimeSeconds ?? undefined) ?? null,
        maxStepCount: toSafeInt(input.maxStepCount ?? undefined) ?? null,
        degradeProvider: normalizeOptionalString(input.degradeProvider) ?? null,
        degradeModel: normalizeOptionalString(input.degradeModel) ?? null,
        forceReadOnlyOnOverage: Boolean(input.forceReadOnlyOnOverage),
        updatedAt: now
      }
    });
    return toBudgetPolicyRecord(row);
  }

  async recordQuotaEvent(params: {
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
  }): Promise<QuotaEventRecord> {
    const row = await db.quotaEvent.create({
      data: {
        id: randomUUID(),
        budgetPolicyId: params.budgetPolicyId ?? null,
        taskId: params.taskId ?? null,
        repoId: params.repoId ?? null,
        robotId: params.robotId ?? null,
        actorUserId: params.actorUserId ?? null,
        scopeType: params.scopeType ?? null,
        scopeId: params.scopeId ?? null,
        eventType: normalizeBudgetQuotaEventType(params.eventType),
        decision: normalizeBudgetGovernanceDecision(params.decision),
        message: params.message,
        details: (params.details ?? undefined) as any,
        createdAt: new Date()
      }
    });
    return toQuotaEventRecord(row);
  }

  async listRecentQuotaEvents(filters: {
    startAt: Date;
    endAt: Date;
    limit: number;
    repoId?: string;
    actorUserId?: string;
    allowedRepoIds?: string[] | null;
  }): Promise<QuotaEventRecord[]> {
    const rows = await db.quotaEvent.findMany({
      where: {
        createdAt: {
          gte: filters.startAt,
          lte: filters.endAt
        },
        ...(filters.repoId ? { repoId: filters.repoId } : {}),
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
        ...(filters.allowedRepoIds === null
          ? {}
          : Array.isArray(filters.allowedRepoIds)
            ? filters.allowedRepoIds.length
              ? { OR: [{ repoId: { in: filters.allowedRepoIds } }, { repoId: null }] }
              : { repoId: null }
            : {})
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(filters.limit, 20))
    });
    return rows.map(toQuotaEventRecord);
  }
}
