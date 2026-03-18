import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { getCheapModelForProvider } from './costRateCard';
import { resolveModelFromProviderConfig } from './executionOverride';
import type { Task } from '../types/task';
import type { PolicyEvaluation } from '../policyEngine/types';
import { resolveProviderRunConfig } from '../utils/providerRunConfig';
import { normalizeRoutedProviderKey } from '../providerRouting/providerRouting.types';
import { BudgetService } from './budget.service';
import { UsageAggregationService } from './usageAggregation.service';
import type {
  BudgetExceededMetric,
  BudgetExecutionOverride,
  BudgetGovernanceResult,
  BudgetPolicyRecord,
  BudgetScopeType
} from './types';
import { toIso } from './types';

const SCOPE_PRIORITY: Record<BudgetScopeType, number> = {
  user: 1,
  repo: 2,
  robot: 3
};

const DECISION_PRIORITY: Record<BudgetGovernanceResult['decision'], number> = {
  allow: 0,
  allow_with_warning: 1,
  degrade: 2,
  require_approval: 3,
  deny: 4
};

type RobotRuntimeContext = {
  provider?: 'codex' | 'claude_code' | 'gemini_cli';
  model?: string;
  sandbox: 'read-only' | 'workspace-write' | 'unknown';
  networkAccess: boolean;
};

const safeTaskSource = (task: Task): 'chat' | 'webhook' | 'manual' => {
  if (task.eventType === 'chat') return 'chat';
  if (task.eventType === 'issue' || task.eventType === 'commit' || task.eventType === 'merge_request' || task.eventType === 'issue_created' || task.eventType === 'issue_comment' || task.eventType === 'note' || task.eventType === 'push' || task.eventType === 'commit_review') {
    return 'webhook';
  }
  return 'manual';
};

@Injectable()
export class QuotaEnforcerService {
  constructor(
    private readonly budgetService: BudgetService,
    private readonly usageAggregationService: UsageAggregationService
  ) {}

  private async loadRobotRuntimeContext(task: Task): Promise<RobotRuntimeContext> {
    if (!task.robotId) return { sandbox: 'unknown', networkAccess: false };
    const robot = await db.repoRobot.findUnique({
      where: { id: task.robotId },
      select: { modelProvider: true, modelProviderConfig: true }
    });
    const provider = normalizeRoutedProviderKey(robot?.modelProvider);
    if (!provider) return { sandbox: 'unknown', networkAccess: false };
    const runConfig = resolveProviderRunConfig(provider, robot?.modelProviderConfig);
    return {
      provider,
      model: resolveModelFromProviderConfig(provider, robot?.modelProviderConfig),
      sandbox: runConfig.sandbox,
      networkAccess: runConfig.networkAccess
    };
  }

  private buildExceededMetrics(policy: BudgetPolicyRecord, usage: {
    daily?: Awaited<ReturnType<UsageAggregationService['getScopeUsageSnapshot']>>;
    monthly?: Awaited<ReturnType<UsageAggregationService['getScopeUsageSnapshot']>>;
  }): BudgetExceededMetric[] {
    const exceeded: BudgetExceededMetric[] = [];
    if (policy.dailyTaskCountLimit !== undefined && usage.daily && usage.daily.taskCount + 1 > policy.dailyTaskCountLimit) {
      exceeded.push({
        key: 'daily_task_count',
        period: 'daily',
        unit: 'tasks',
        actual: usage.daily.taskCount + 1,
        limit: policy.dailyTaskCountLimit
      });
    }
    if (policy.monthlyTaskCountLimit !== undefined && usage.monthly && usage.monthly.taskCount + 1 > policy.monthlyTaskCountLimit) {
      exceeded.push({
        key: 'monthly_task_count',
        period: 'monthly',
        unit: 'tasks',
        actual: usage.monthly.taskCount + 1,
        limit: policy.monthlyTaskCountLimit
      });
    }
    if (policy.dailyTokenLimit !== undefined && usage.daily && usage.daily.totalTokens >= policy.dailyTokenLimit) {
      exceeded.push({
        key: 'daily_tokens',
        period: 'daily',
        unit: 'tokens',
        actual: usage.daily.totalTokens,
        limit: policy.dailyTokenLimit
      });
    }
    if (policy.monthlyTokenLimit !== undefined && usage.monthly && usage.monthly.totalTokens >= policy.monthlyTokenLimit) {
      exceeded.push({
        key: 'monthly_tokens',
        period: 'monthly',
        unit: 'tokens',
        actual: usage.monthly.totalTokens,
        limit: policy.monthlyTokenLimit
      });
    }
    if (policy.dailyEstimatedCostUsdLimit !== undefined && usage.daily) {
      const actual = Number(usage.daily.estimatedCostMicroUsd) / 1_000_000;
      if (actual >= policy.dailyEstimatedCostUsdLimit) {
        exceeded.push({
          key: 'daily_cost_usd',
          period: 'daily',
          unit: 'usd',
          actual: Math.round(actual * 1_000_000) / 1_000_000,
          limit: policy.dailyEstimatedCostUsdLimit
        });
      }
    }
    if (policy.monthlyEstimatedCostUsdLimit !== undefined && usage.monthly) {
      const actual = Number(usage.monthly.estimatedCostMicroUsd) / 1_000_000;
      if (actual >= policy.monthlyEstimatedCostUsdLimit) {
        exceeded.push({
          key: 'monthly_cost_usd',
          period: 'monthly',
          unit: 'usd',
          actual: Math.round(actual * 1_000_000) / 1_000_000,
          limit: policy.monthlyEstimatedCostUsdLimit
        });
      }
    }
    return exceeded;
  }

  private describeExceeded(exceeded: BudgetExceededMetric[]): string {
    return exceeded
      .map((item) => {
        const actual = item.unit === 'usd' ? item.actual.toFixed(2) : String(item.actual);
        const limit = item.unit === 'usd' ? item.limit.toFixed(2) : String(item.limit);
        return `${item.key} ${actual}/${limit}`;
      })
      .join(', ');
  }

  private buildDegradeOverride(policy: BudgetPolicyRecord, runtime: RobotRuntimeContext): BudgetExecutionOverride | undefined {
    const provider = policy.degradeProvider ?? (runtime.provider && runtime.provider !== 'gemini_cli' ? 'gemini_cli' : runtime.provider);
    const model = policy.degradeModel ?? (provider ? getCheapModelForProvider(provider) : undefined);
    const forceReadOnly = policy.forceReadOnlyOnOverage || runtime.sandbox === 'workspace-write';

    if (!provider && !model && !forceReadOnly) return undefined;
    return {
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(forceReadOnly ? { forceReadOnly: true } : {})
    };
  }

  private mergeExecutionOverride(base: BudgetExecutionOverride | undefined, patch: BudgetExecutionOverride | undefined): BudgetExecutionOverride | undefined {
    if (!base && !patch) return undefined;
    return {
      ...(base ?? {}),
      ...(patch ?? {})
    };
  }

  async evaluateTask(task: Task): Promise<BudgetGovernanceResult | null> {
    const policies = await this.budgetService.listApplicablePolicies(task);
    if (!policies.length) return null;

    const runtime = await this.loadRobotRuntimeContext(task);
    const evaluatedAt = new Date().toISOString();
    let executionOverride: BudgetExecutionOverride | undefined;

    for (const policy of policies) {
      if (policy.maxRuntimeSeconds !== undefined) {
        executionOverride = this.mergeExecutionOverride(executionOverride, {
          ...(executionOverride ?? {}),
          maxRuntimeSeconds:
            executionOverride?.maxRuntimeSeconds === undefined
              ? policy.maxRuntimeSeconds
              : Math.min(executionOverride.maxRuntimeSeconds, policy.maxRuntimeSeconds)
        });
      }
      if (policy.maxStepCount !== undefined) {
        executionOverride = this.mergeExecutionOverride(executionOverride, {
          ...(executionOverride ?? {}),
          maxStepCount:
            executionOverride?.maxStepCount === undefined
              ? policy.maxStepCount
              : Math.min(executionOverride.maxStepCount, policy.maxStepCount)
        });
      }
    }

    const findings: Array<BudgetGovernanceResult & { policy: BudgetPolicyRecord }> = [];

    for (const policy of policies) {
      const dailyNeeded =
        policy.dailyTaskCountLimit !== undefined ||
        policy.dailyTokenLimit !== undefined ||
        policy.dailyEstimatedCostUsdLimit !== undefined;
      const monthlyNeeded =
        policy.monthlyTaskCountLimit !== undefined ||
        policy.monthlyTokenLimit !== undefined ||
        policy.monthlyEstimatedCostUsdLimit !== undefined;

      const [dailyUsage, monthlyUsage] = await Promise.all([
        dailyNeeded
          ? this.usageAggregationService.getScopeUsageSnapshot({
              scopeType: policy.scopeType,
              scopeId: policy.scopeId,
              startAt: new Date(new Date().setUTCHours(0, 0, 0, 0)),
              endAt: new Date(),
              excludeTaskId: task.id
            })
          : Promise.resolve(undefined),
        monthlyNeeded
          ? this.usageAggregationService.getScopeUsageSnapshot({
              scopeType: policy.scopeType,
              scopeId: policy.scopeId,
              startAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
              endAt: new Date(),
              excludeTaskId: task.id
            })
          : Promise.resolve(undefined)
      ]);

      const exceeded = this.buildExceededMetrics(policy, { daily: dailyUsage, monthly: monthlyUsage });
      if (!exceeded.length) continue;

      const summaryBase = `${policy.name || `${policy.scopeType}:${policy.scopeId}`}: ${this.describeExceeded(exceeded)}`;

      if (policy.overageAction === 'hard_limit') {
        findings.push({
          policy,
          decision: 'deny',
          policyMode: policy.overageAction,
          summary: `Budget limit reached, execution blocked (${summaryBase}).`,
          matchedPolicyId: policy.id,
          matchedPolicyName: policy.name,
          matchedScopeType: policy.scopeType,
          matchedScopeId: policy.scopeId,
          exceeded,
          warnings: [],
          executionOverride,
          evaluatedAt
        });
        continue;
      }

      if (policy.overageAction === 'manual_approval') {
        findings.push({
          policy,
          decision: 'require_approval',
          policyMode: policy.overageAction,
          summary: `Budget limit reached, approval required (${summaryBase}).`,
          matchedPolicyId: policy.id,
          matchedPolicyName: policy.name,
          matchedScopeType: policy.scopeType,
          matchedScopeId: policy.scopeId,
          exceeded,
          warnings: [],
          executionOverride,
          evaluatedAt
        });
        continue;
      }

      if (policy.overageAction === 'degrade') {
        const degradeOverride = this.buildDegradeOverride(policy, runtime);
        if (degradeOverride) {
          findings.push({
            policy,
            decision: 'degrade',
            policyMode: policy.overageAction,
            summary: `Budget limit reached, execution degraded (${summaryBase}).`,
            matchedPolicyId: policy.id,
            matchedPolicyName: policy.name,
            matchedScopeType: policy.scopeType,
            matchedScopeId: policy.scopeId,
            exceeded,
            warnings: [],
            executionOverride: this.mergeExecutionOverride(executionOverride, degradeOverride),
            evaluatedAt
          });
          continue;
        }
      }

      findings.push({
        policy,
        decision: 'allow_with_warning',
        policyMode: policy.overageAction,
        summary: `Budget limit reached, execution allowed with warning (${summaryBase}).`,
        matchedPolicyId: policy.id,
        matchedPolicyName: policy.name,
        matchedScopeType: policy.scopeType,
        matchedScopeId: policy.scopeId,
        exceeded,
        warnings: [],
        executionOverride,
        evaluatedAt
      });
    }

    if (!findings.length) {
      if (!executionOverride) return null;
      return {
        decision: 'allow',
        exceeded: [],
        warnings: [],
        executionOverride,
        evaluatedAt
      };
    }

    findings.sort((a, b) => {
      const decisionDelta = DECISION_PRIORITY[b.decision] - DECISION_PRIORITY[a.decision];
      if (decisionDelta !== 0) return decisionDelta;
      const scopeDelta = SCOPE_PRIORITY[b.policy.scopeType] - SCOPE_PRIORITY[a.policy.scopeType];
      if (scopeDelta !== 0) return scopeDelta;
      return b.policy.updatedAt.localeCompare(a.policy.updatedAt);
    });

    const primary = findings[0];
    const warnings = findings.slice(1).map((item) => item.summary || '').filter(Boolean);

    return {
      decision: primary.decision,
      policyMode: primary.policyMode,
      summary: primary.summary,
      matchedPolicyId: primary.matchedPolicyId,
      matchedPolicyName: primary.matchedPolicyName,
      matchedScopeType: primary.matchedScopeType,
      matchedScopeId: primary.matchedScopeId,
      exceeded: primary.exceeded,
      warnings,
      executionOverride: primary.executionOverride ?? executionOverride,
      evaluatedAt
    };
  }

  async toApprovalEvaluation(task: Task, evaluation: BudgetGovernanceResult): Promise<PolicyEvaluation> {
    const runtime = await this.loadRobotRuntimeContext(task);
    const reasons = [evaluation.summary || 'Budget policy requires approval.', ...evaluation.warnings].filter(Boolean);
    return {
      decision: 'require_approval',
      riskLevel: 'high',
      summary: evaluation.summary || 'Budget policy requires approval.',
      details: {
        taskSource: safeTaskSource(task),
        provider: runtime.provider,
        sandbox: runtime.sandbox,
        networkAccess: runtime.networkAccess,
        targetFiles: [],
        commands: [],
        reasons,
        warnings: evaluation.warnings,
        matchedRules: [
          {
            id: evaluation.matchedPolicyId,
            name: evaluation.matchedPolicyName || 'Budget policy',
            action: 'require_approval',
            source: 'builtin'
          }
        ]
      }
    };
  }
}
