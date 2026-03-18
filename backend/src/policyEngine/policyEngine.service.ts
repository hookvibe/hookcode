import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { CODEX_PROVIDER_KEY, normalizeCodexRobotProviderConfig } from '../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY, normalizeClaudeCodeRobotProviderConfig } from '../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY, normalizeGeminiCliRobotProviderConfig } from '../modelProviders/geminiCli';
import type { Task } from '../types/task';
import { buildPolicySummary, classifyTaskRisk } from './riskClassifier';
import type {
  PolicyDecision,
  PolicyEvaluation,
  PolicyMatchedRule,
  PolicyRuleConditions,
  PolicyRuleRecord,
  PolicySandbox,
  PolicyTaskContext,
  PolicyTaskSource
} from './types';

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const safeRegexTest = (pattern: string, value: string): boolean => {
  try {
    return new RegExp(pattern, 'i').test(value);
  } catch {
    return false;
  }
};

const normalizePolicyDecision = (value: unknown): PolicyDecision => {
  const raw = normalizeString(value).toLowerCase();
  if (raw === 'allow' || raw === 'allow_with_warning' || raw === 'require_approval' || raw === 'deny') return raw;
  return 'allow';
};

export const normalizePolicyRuleConditions = (value: unknown): PolicyRuleConditions => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const normalizeList = (field: unknown): string[] | undefined => {
    if (!Array.isArray(field)) return undefined;
    const list = field.map((item) => normalizeString(item)).filter(Boolean);
    return list.length ? list : undefined;
  };

  return {
    providers: normalizeList(raw.providers),
    taskSources: normalizeList(raw.taskSources) as PolicyTaskSource[] | undefined,
    sandboxes: normalizeList(raw.sandboxes) as Array<'read-only' | 'workspace-write'> | undefined,
    networkAccess: typeof raw.networkAccess === 'boolean' ? raw.networkAccess : undefined,
    riskLevels: normalizeList(raw.riskLevels) as any,
    repoProviders: normalizeList(raw.repoProviders),
    eventTypes: normalizeList(raw.eventTypes),
    commandPatterns: normalizeList(raw.commandPatterns),
    targetPathPatterns: normalizeList((raw as any).targetPathPatterns ?? (raw as any).targetFilePatterns)
  };
};

export interface PolicyRuleUpsertInput {
  id?: string;
  repoId?: string | null;
  robotId?: string | null;
  name: string;
  enabled?: boolean;
  priority?: number;
  action: PolicyDecision;
  conditions?: PolicyRuleConditions;
  actorUserId?: string;
}

const normalizePolicyTaskSource = (task: Pick<Task, 'eventType' | 'payload'>): PolicyTaskSource => {
  if (task.eventType === 'chat') return 'chat';
  const payload = task.payload as Record<string, unknown> | null;
  if (payload && typeof payload === 'object' && payload !== null && '__chat' in payload) return 'chat';
  return 'webhook';
};

const collectStrings = (value: unknown, bucket: string[], seen: WeakSet<object>, depth = 0): void => {
  if (depth > 6) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) bucket.push(trimmed);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, bucket, seen, depth + 1);
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectStrings(item, bucket, seen, depth + 1);
  }
};

const extractTargetFiles = (text: string): string[] => {
  const matches = new Set<string>();
  const patterns = [
    /\bpackage\.json\b/gi,
    /\bpackage-lock\.json\b/gi,
    /\bpnpm-lock\.yaml\b/gi,
    /\byarn\.lock\b/gi,
    /\bbun\.lockb\b/gi,
    /\bDockerfile\b/gi,
    /\bdocker-compose(?:\.[a-z0-9_-]+)?\.ya?ml\b/gi,
    /\binfra\/[A-Za-z0-9_./-]*/gi,
    /\bdocker\/[A-Za-z0-9_./-]*/gi,
    /\bdeployment\/[A-Za-z0-9_./-]*/gi,
    /\bdeploy\/[A-Za-z0-9_./-]*/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const item = normalizeString(match[0]);
      if (item) matches.add(item.replace(/[`'",.]+$/g, ''));
    }
  }

  return Array.from(matches);
};

const extractCommands = (text: string): string[] => {
  const matches = new Set<string>();
  const patterns = [
    /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update|run\s+\S+)/gi,
    /\b(?:bash|sh|zsh)\s+\S+/gi,
    /\bdocker\s+[^\n\r`]+/gi,
    /\bkubectl\s+[^\n\r`]+/gi,
    /\bhelm\s+[^\n\r`]+/gi,
    /\bterraform\s+[^\n\r`]+/gi,
    /\bgit push\b/gi,
    /\bgh\s+(?:pr|mr)\s+[^\n\r`]+/gi,
    /\bglab\s+(?:mr|pr)\s+[^\n\r`]+/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const item = normalizeString(match[0]);
      if (item) matches.add(item.replace(/\s+/g, ' '));
    }
  }

  return Array.from(matches);
};

const mapPolicyRule = (row: any): PolicyRuleRecord => ({
  id: String(row.id),
  repoId: row.repoId ? String(row.repoId) : undefined,
  robotId: row.robotId ? String(row.robotId) : undefined,
  name: String(row.name ?? 'Policy rule'),
  enabled: Boolean(row.enabled),
  priority: Number(row.priority ?? 100) || 100,
  action: normalizePolicyDecision(row.action),
  conditions: normalizePolicyRuleConditions(row.conditions ?? row.conditionsJson ?? row.conditions_json ?? undefined),
  createdByUserId: row.createdByUserId ? String(row.createdByUserId) : row.created_by_user_id ? String(row.created_by_user_id) : undefined,
  updatedByUserId: row.updatedByUserId ? String(row.updatedByUserId) : row.updated_by_user_id ? String(row.updated_by_user_id) : undefined,
  createdAt: toIso(row.createdAt ?? row.created_at),
  updatedAt: toIso(row.updatedAt ?? row.updated_at)
});

const ruleMatches = (rule: PolicyRuleRecord, context: PolicyTaskContext, riskLevel: string): boolean => {
  const conditions = rule.conditions ?? {};
  const targetFilePatterns = conditions.targetFilePatterns ?? conditions.targetPathPatterns;
  if (conditions.providers?.length && !conditions.providers.includes(context.provider ?? '')) return false;
  if (conditions.repoProviders?.length && !conditions.repoProviders.includes(context.repoProvider ?? '')) return false;
  if (conditions.eventTypes?.length && !conditions.eventTypes.includes(context.eventType ?? '')) return false;
  if (conditions.taskSources?.length && !conditions.taskSources.includes(context.taskSource)) return false;
  if (conditions.sandboxes?.length && !conditions.sandboxes.includes(context.sandbox === 'unknown' ? 'read-only' : context.sandbox)) return false;
  if (typeof conditions.networkAccess === 'boolean' && conditions.networkAccess !== context.networkAccess) return false;
  if (conditions.riskLevels?.length && !conditions.riskLevels.includes(riskLevel as any)) return false;
  if (
    targetFilePatterns?.length &&
    !targetFilePatterns.some((pattern: string) => context.targetFiles.some((item) => safeRegexTest(pattern, item)))
  ) {
    return false;
  }
  if (
    conditions.commandPatterns?.length &&
    !conditions.commandPatterns.some((pattern) => context.commands.some((item) => safeRegexTest(pattern, item)))
  ) {
    return false;
  }
  return true;
};

@Injectable()
export class PolicyEngineService {
  async listPolicyRules(options?: { repoId?: string; robotId?: string; enabledOnly?: boolean }): Promise<PolicyRuleRecord[]> {
    const rows = await db.policyRule.findMany({
      where: {
        ...(options?.repoId ? { repoId: options.repoId } : {}),
        ...(options?.robotId ? { robotId: options.robotId } : {}),
        ...(options?.enabledOnly ? { enabled: true } : {})
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
    });
    return rows.map(mapPolicyRule);
  }

  async evaluateTask(
    task: Pick<Task, 'id' | 'repoId' | 'repoProvider' | 'robotId' | 'actorUserId' | 'eventType' | 'payload' | 'title' | 'promptCustom'>
  ): Promise<PolicyEvaluation> {
    const context = await this.buildTaskContext(task);
    const classification = classifyTaskRisk(context);
    const rules = await this.listEffectiveRules(task.repoId, task.robotId);
    const matchedRules = rules.filter((rule) => ruleMatches(rule, context, classification.riskLevel));

    let decision: PolicyDecision;
    let selectedRules: PolicyMatchedRule[];

    if (matchedRules.length > 0) {
      decision = matchedRules[0].action;
      selectedRules = matchedRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        action: rule.action,
        source: 'policy_rule'
      }));
    } else if (classification.riskLevel === 'critical' || classification.riskLevel === 'high' || context.sandbox === 'workspace-write') {
      decision = 'require_approval';
      selectedRules = [
        {
          name: 'Built-in high-risk approval gate',
          action: 'require_approval',
          source: 'builtin'
        }
      ];
    } else if (classification.riskLevel === 'medium' || classification.warnings.length > 0) {
      decision = 'allow_with_warning';
      selectedRules = [
        {
          name: 'Built-in warning policy',
          action: 'allow_with_warning',
          source: 'builtin'
        }
      ];
    } else {
      decision = 'allow';
      selectedRules = [
        {
          name: 'Built-in default allow policy',
          action: 'allow',
          source: 'builtin'
        }
      ];
    }

    return {
      decision,
      riskLevel: classification.riskLevel,
      summary: buildPolicySummary({
        decision,
        riskLevel: classification.riskLevel,
        reasons: classification.reasons,
        matchedRules: selectedRules
      }),
      details: {
        taskSource: context.taskSource,
        provider: context.provider,
        sandbox: context.sandbox,
        networkAccess: context.networkAccess,
        targetFiles: context.targetFiles,
        commands: context.commands,
        reasons: classification.reasons,
        warnings: classification.warnings,
        matchedRules: selectedRules
      }
    };
  }

  async upsertPolicyRules(inputs: PolicyRuleUpsertInput[]): Promise<PolicyRuleRecord[]> {
    const now = new Date();
    const result: PolicyRuleRecord[] = [];

    for (const input of inputs) {
      const data = {
        repoId: input.repoId ?? null,
        robotId: input.robotId ?? null,
        name: String(input.name ?? '').trim() || 'Policy rule',
        enabled: input.enabled ?? true,
        priority: Number.isFinite(input.priority) ? Math.max(0, Math.floor(Number(input.priority))) : 100,
        action: normalizePolicyDecision(input.action),
        conditions: normalizePolicyRuleConditions(input.conditions ?? {}) as any,
        updatedByUserId: input.actorUserId ?? null,
        updatedAt: now
      };

      const row = input.id
        ? await db.policyRule.update({
            where: { id: input.id },
            data
          })
        : await db.policyRule.create({
            data: {
              id: randomUUID(),
              ...data,
              createdByUserId: input.actorUserId ?? null,
              createdAt: now
            }
          });
      result.push(mapPolicyRule(row));
    }

    return result;
  }

  async replacePolicyRules(params: {
    repoId?: string;
    robotId?: string;
    actorUserId?: string;
    rules: Array<{
      name: string;
      enabled?: boolean;
      priority?: number;
      action: PolicyDecision;
      conditions?: PolicyRuleConditions;
    }>;
  }): Promise<PolicyRuleRecord[]> {
    const repoId = params.repoId ?? null;
    const robotId = params.robotId ?? null;
    await db.policyRule.deleteMany({
      where: { repoId, robotId }
    });
    if (!params.rules.length) return [];
    return this.upsertPolicyRules(
      params.rules.map((rule) => ({
        repoId,
        robotId,
        actorUserId: params.actorUserId,
        name: rule.name,
        enabled: rule.enabled,
        priority: rule.priority,
        action: rule.action,
        conditions: normalizePolicyRuleConditions(rule.conditions)
      }))
    );
  }

  private async listEffectiveRules(repoId?: string, robotId?: string): Promise<PolicyRuleRecord[]> {
    const rows = await db.policyRule.findMany({
      where: {
        enabled: true,
        AND: [{ OR: [{ repoId: null }, ...(repoId ? [{ repoId }] : [])] }, { OR: [{ robotId: null }, ...(robotId ? [{ robotId }] : [])] }]
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
    });
    return rows.map(mapPolicyRule);
  }

  private async buildTaskContext(
    task: Pick<Task, 'id' | 'repoId' | 'repoProvider' | 'robotId' | 'actorUserId' | 'eventType' | 'payload' | 'title' | 'promptCustom'>
  ): Promise<PolicyTaskContext> {
    const robot = task.robotId
      ? await db.repoRobot.findUnique({
          where: { id: task.robotId },
          select: { modelProvider: true, modelProviderConfig: true }
        })
      : null;

    const provider = normalizeString(robot?.modelProvider).toLowerCase() || undefined;
    const providerConfig = robot?.modelProviderConfig ?? undefined;
    const normalized = this.normalizeProviderPolicyConfig(provider, providerConfig);

    const strings: string[] = [];
    const seen = new WeakSet<object>();
    collectStrings(task.payload, strings, seen);
    if (task.title) strings.push(task.title);
    if (task.promptCustom) strings.push(task.promptCustom);
    const textCorpus = strings.join('\n');

    return {
      taskId: task.id,
      repoId: task.repoId,
      repoProvider: task.repoProvider,
      robotId: task.robotId,
      actorUserId: task.actorUserId,
      eventType: task.eventType,
      taskSource: normalizePolicyTaskSource(task),
      provider,
      sandbox: normalized.sandbox,
      networkAccess: normalized.networkAccess,
      textCorpus,
      targetFiles: extractTargetFiles(textCorpus),
      commands: extractCommands(textCorpus)
    };
  }

  private normalizeProviderPolicyConfig(provider: string | undefined, rawConfig: unknown): { sandbox: PolicySandbox; networkAccess: boolean } {
    if (provider === CODEX_PROVIDER_KEY) {
      const config = normalizeCodexRobotProviderConfig(rawConfig);
      return { sandbox: config.sandbox, networkAccess: true };
    }
    if (provider === CLAUDE_CODE_PROVIDER_KEY) {
      const config = normalizeClaudeCodeRobotProviderConfig(rawConfig);
      return {
        sandbox: config.sandbox,
        networkAccess: config.sandbox === 'workspace-write' && Boolean(config.sandbox_workspace_write.network_access)
      };
    }
    if (provider === GEMINI_CLI_PROVIDER_KEY) {
      const config = normalizeGeminiCliRobotProviderConfig(rawConfig);
      return {
        sandbox: config.sandbox,
        networkAccess: config.sandbox === 'workspace-write' && Boolean(config.sandbox_workspace_write.network_access)
      };
    }
    return { sandbox: 'unknown', networkAccess: false };
  }
}
