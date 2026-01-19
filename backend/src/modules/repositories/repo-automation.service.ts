import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import type {
  AutomationClause,
  AutomationEventConfig,
  AutomationRule,
  RepoAutomationConfig
} from '../../types/automation';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeEventConfig = (value: unknown): AutomationEventConfig => {
  if (!isRecord(value)) return { enabled: true, rules: [] };
  return {
    enabled: asBoolean(value.enabled, true),
    rules: asArray(value.rules)
      .map(normalizeRule)
      .filter((v): v is AutomationRule => Boolean(v))
  };
};

const normalizeClause = (value: unknown): AutomationClause | null => {
  if (!isRecord(value)) return null;
  const field = asString(value.field).trim();
  const op = asString(value.op).trim();
  if (!field) return null;
  if (!['equals', 'in', 'containsAny', 'matchesAny', 'exists', 'textContainsAny'].includes(op)) {
    return null;
  }

  const clause: AutomationClause = {
    field,
    op: op as any,
    negate: asBoolean(value.negate, false)
  };

  if (typeof value.value === 'string') clause.value = value.value;
  if (Array.isArray(value.values)) {
    clause.values = value.values
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return clause;
};

const normalizeRule = (value: unknown): AutomationRule | null => {
  if (!isRecord(value)) return null;
  const id = asString(value.id).trim() || randomUUID();
  const name = asString(value.name).trim();
  const enabled = asBoolean(value.enabled, true);

  const actions = asArray(value.actions)
    .map((a) => {
      if (!isRecord(a)) return null;
      const actionId = asString(a.id).trim() || randomUUID();
      const robotId = asString(a.robotId).trim();
      if (!robotId) return null;
      return {
        id: actionId,
        robotId,
        enabled: asBoolean(a.enabled, true),
        promptOverride: typeof a.promptOverride === 'string' ? a.promptOverride : undefined,
        promptPatch: typeof a.promptPatch === 'string' ? a.promptPatch : undefined
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  const matchRaw = isRecord(value.match) ? value.match : null;
  const all = matchRaw
    ? asArray(matchRaw.all)
        .map(normalizeClause)
        .filter((v): v is AutomationClause => Boolean(v))
    : [];
  const any = matchRaw
    ? asArray(matchRaw.any)
        .map(normalizeClause)
        .filter((v): v is AutomationClause => Boolean(v))
    : [];

  return {
    id,
    name,
    enabled,
    match: all.length || any.length ? { all: all.length ? all : undefined, any: any.length ? any : undefined } : undefined,
    actions
  };
};

const stripIssueUnsupportedClauses = (rule: AutomationRule): AutomationRule => {
  // Strip branch-based filters for Issue rules because Issue webhooks have no branch/ref context. b7x1k3m9p2r5t8n0q6s4
  const match = rule.match;
  if (!match) return rule;
  const keep = (c: AutomationClause) => !(c.field === 'push.branch' || c.field === 'branch.name' || c.field.startsWith('branch.'));
  const all = (match.all ?? []).filter(keep);
  const any = (match.any ?? []).filter(keep);
  const nextMatch = all.length || any.length ? { all: all.length ? all : undefined, any: any.length ? any : undefined } : undefined;
  return { ...rule, match: nextMatch };
};

const buildDefaultConfig = (): RepoAutomationConfig => ({
  version: 2,
  events: {
    issue: { enabled: true, rules: [] },
    commit: { enabled: true, rules: [] },
    merge_request: { enabled: true, rules: [] }
  }
});

const addSubTypeClause = (rule: AutomationRule, subType: string): AutomationRule => {
  const clause: AutomationClause = { field: 'event.subType', op: 'in', values: [subType] };
  if (!rule.match) {
    return { ...rule, match: { all: [clause] } };
  }
  const all = [...(rule.match.all ?? [])];
  all.unshift(clause);
  return { ...rule, match: { ...rule.match, all } };
};

const migrateV1ToV2 = (raw: unknown): RepoAutomationConfig => {
  if (!isRecord(raw)) return buildDefaultConfig();
  const base = buildDefaultConfig();
  const eventsRaw = isRecord(raw.events) ? raw.events : {};

  const v1IssueCreated = normalizeEventConfig(eventsRaw.issue_created);
  const v1IssueComment = normalizeEventConfig(eventsRaw.issue_comment);
  const v1CommitReview = normalizeEventConfig(eventsRaw.commit_review);

  const issueRules: AutomationRule[] = [
    ...(v1IssueCreated.rules ?? []).map((r) => addSubTypeClause(r, 'created')),
    ...(v1IssueComment.rules ?? []).map((r) => addSubTypeClause(r, 'commented'))
  ];
  const commitRules: AutomationRule[] = [...(v1CommitReview.rules ?? []).map((r) => addSubTypeClause(r, 'created'))];

  return {
    version: 2,
    events: {
      ...base.events,
      issue: { enabled: v1IssueCreated.enabled || v1IssueComment.enabled, rules: issueRules },
      commit: { enabled: v1CommitReview.enabled, rules: commitRules }
    }
  };
};

const normalizeConfig = (raw: unknown): RepoAutomationConfig => {
  if (!isRecord(raw)) return buildDefaultConfig();
  const version = raw.version === 2 ? 2 : raw.version === 1 ? 1 : 2;
  if (version === 1) {
    const migrated = migrateV1ToV2(raw);
    if (migrated.events.issue) {
      migrated.events.issue = { ...migrated.events.issue, rules: (migrated.events.issue.rules ?? []).map(stripIssueUnsupportedClauses) };
    }
    return migrated;
  }
  const eventsRaw = isRecord(raw.events) ? raw.events : {};
  const events: RepoAutomationConfig['events'] = {};
  for (const [key, value] of Object.entries(eventsRaw)) {
    events[key] = normalizeEventConfig(value);
  }
  const base = buildDefaultConfig();
  // Merge default events to avoid missing keys.
  const merged: RepoAutomationConfig = {
    version: 2,
    events: {
      ...base.events,
      ...events
    }
  };
  if (merged.events.issue) {
    merged.events.issue = { ...merged.events.issue, rules: (merged.events.issue.rules ?? []).map(stripIssueUnsupportedClauses) };
  }
  return merged;
};

export class RepoAutomationConfigValidationError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, params: { code: string; details?: Record<string, unknown> }) {
    super(message);
    this.name = 'RepoAutomationConfigValidationError';
    this.code = params.code;
    this.details = params.details;
  }
}

export const validateAutomationConfigOrThrow = (config: RepoAutomationConfig): void => {
  const eventsRaw = isRecord(config?.events) ? config.events : {};
  for (const [eventKey, eventConfig] of Object.entries(eventsRaw)) {
    if (!eventConfig) continue;
    const rules = Array.isArray((eventConfig as any).rules) ? (eventConfig as any).rules : [];
    for (const rule of rules) {
      const ruleId = isRecord(rule) ? asString(rule.id).trim() : undefined;
      const ruleName = isRecord(rule) ? asString(rule.name).trim() : undefined;
      if (!ruleName) {
        throw new RepoAutomationConfigValidationError('Automation rule name is required', {
          code: 'RULE_NAME_REQUIRED',
          details: { eventKey, ruleId, ruleName }
        });
      }
      const actions = Array.isArray((rule as any)?.actions) ? (rule as any).actions : [];
      if (!actions.length) {
        throw new RepoAutomationConfigValidationError('Automation rule must select at least 1 robot', {
          code: 'RULE_ROBOT_REQUIRED',
          details: {
            eventKey,
            ruleId,
            ruleName
          }
        });
      }
    }
  }
};

export interface RobotAutomationUsage {
  eventKey: string;
  ruleId: string;
  ruleName: string;
}

export const findRobotAutomationUsages = (config: RepoAutomationConfig, robotId: string): RobotAutomationUsage[] => {
  const usages: RobotAutomationUsage[] = [];
  const seen = new Set<string>();
  const eventsRaw = isRecord(config?.events) ? config.events : {};
  for (const [eventKey, eventConfig] of Object.entries(eventsRaw)) {
    if (!eventConfig) continue;
    const rules = Array.isArray((eventConfig as any).rules) ? (eventConfig as any).rules : [];
    for (const rule of rules) {
      if (!isRecord(rule)) continue;
      const actions = Array.isArray(rule.actions) ? rule.actions : [];
      const hit = actions.some((a) => isRecord(a) && asString(a.robotId).trim() === robotId);
      if (!hit) continue;
      const ruleId = asString(rule.id).trim();
      // Change record (2026-01-15): rule name fallback is now English for consistent automation summaries.
      const ruleName = asString(rule.name).trim() || 'Unnamed rule';
      const key = `${eventKey}:${ruleId || ruleName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      usages.push({ eventKey, ruleId, ruleName });
    }
  }
  return usages;
};

@Injectable()
export class RepoAutomationService {
  async getConfig(repoId: string): Promise<RepoAutomationConfig> {
    const row = await db.repoAutomationConfig.findUnique({
      where: { repoId },
      select: { config: true }
    });
    if (!row) {
      const cfg = buildDefaultConfig();
      await this.upsertConfig(repoId, cfg);
      return cfg;
    }
    return normalizeConfig(row.config);
  }

  async upsertConfig(repoId: string, config: RepoAutomationConfig): Promise<RepoAutomationConfig> {
    const now = new Date();
    const normalized = normalizeConfig(config);
    validateAutomationConfigOrThrow(normalized);
    const row = await db.repoAutomationConfig.upsert({
      where: { repoId },
      create: {
        repoId,
        config: normalized as any,
        createdAt: now,
        updatedAt: now
      },
      update: {
        config: normalized as any,
        updatedAt: now
      },
      select: { config: true }
    });
    return normalizeConfig(row.config);
  }

  async updateConfig(repoId: string, config: RepoAutomationConfig): Promise<RepoAutomationConfig> {
    return this.upsertConfig(repoId, config);
  }
}
