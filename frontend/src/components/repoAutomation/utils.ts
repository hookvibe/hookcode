import type { AutomationClause, AutomationRule, AutomationEventKey, RepoAutomationConfig, RepoAutomationConfigV2 } from '../../api';

/**
 * Repo automation helpers:
 * - Business context: repository automation rules (trigger -> actions).
 * - Purpose: normalize v1/v2 config formats and provide immutable update helpers for the editor UI.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to power `frontend-chat` RepoDetail automation tab.
 */

export const uuid = (): string => {
  const anyCrypto: any = typeof crypto !== 'undefined' ? crypto : null;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
};

const addSubTypeClause = (rule: AutomationRule, subType: string): AutomationRule => {
  const clause: AutomationClause = { field: 'event.subType', op: 'in', values: [subType] };
  if (!rule.match) return { ...rule, match: { all: [clause] } };
  return { ...rule, match: { ...rule.match, all: [clause, ...(rule.match.all ?? [])] } };
};

export const normalizeAutomationConfig = (input: RepoAutomationConfig | undefined | null): RepoAutomationConfigV2 => {
  const base: RepoAutomationConfigV2 = {
    version: 2,
    events: {
      issue: { enabled: true, rules: [] },
      commit: { enabled: true, rules: [] },
      merge_request: { enabled: true, rules: [] }
    }
  };

  if (!input || typeof input !== 'object') return base;

  if ((input as any).version === 1) {
    const v1 = input as any;
    const issueCreated = v1.events?.issue_created;
    const issueComment = v1.events?.issue_comment;
    const commitReview = v1.events?.commit_review;
    const issueRules: AutomationRule[] = [
      ...((issueCreated?.rules ?? []) as AutomationRule[]).map((r) => addSubTypeClause(r, 'created')),
      ...((issueComment?.rules ?? []) as AutomationRule[]).map((r) => addSubTypeClause(r, 'commented'))
    ];
    const commitRules: AutomationRule[] = [...((commitReview?.rules ?? []) as AutomationRule[]).map((r) => addSubTypeClause(r, 'created'))];
    return {
      version: 2,
      events: {
        ...base.events,
        issue: { enabled: Boolean(issueCreated?.enabled) || Boolean(issueComment?.enabled), rules: issueRules },
        commit: { enabled: Boolean(commitReview?.enabled), rules: commitRules }
      }
    };
  }

  if ((input as any).version !== 2) return base;
  const events = (input as any).events && typeof (input as any).events === 'object' ? (input as any).events : {};
  return {
    version: 2,
    events: {
      ...base.events,
      ...events
    }
  };
};

export const getEventConfig = (config: RepoAutomationConfigV2, eventKey: AutomationEventKey) => {
  const found = config.events[String(eventKey)];
  if (found) return found;
  return { enabled: true, rules: [] };
};

export const setEventConfig = (config: RepoAutomationConfigV2, eventKey: AutomationEventKey, next: any): RepoAutomationConfigV2 => {
  return {
    ...config,
    events: {
      ...config.events,
      [String(eventKey)]: next
    }
  };
};

export const upsertRule = (rules: AutomationRule[], nextRule: AutomationRule): AutomationRule[] => {
  const idx = rules.findIndex((r) => r.id === nextRule.id);
  if (idx < 0) return [...rules, nextRule];
  return rules.map((r) => (r.id === nextRule.id ? nextRule : r));
};

export const removeRule = (rules: AutomationRule[], ruleId: string): AutomationRule[] => rules.filter((r) => r.id !== ruleId);

export const findClause = (rule: AutomationRule, pred: (c: AutomationClause) => boolean): AutomationClause | undefined => {
  const all = rule.match?.all ?? [];
  const any = rule.match?.any ?? [];
  return [...all, ...any].find(pred);
};

// Share trigger rule string normalization helpers across automation UI modules. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
export const toLowerTrim = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export const normalizeMentionHandle = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const noAt = raw.startsWith('@') ? raw.slice(1).trim() : raw;
  if (!noAt) return '';
  const lower = noAt.toLowerCase();
  return lower
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
};

export const extractInValues = (clause?: AutomationClause): string[] => {
  if (!clause) return [];
  if (Array.isArray(clause.values)) return clause.values.filter(Boolean);
  if (typeof clause.value === 'string' && clause.value.trim()) return [clause.value.trim()];
  return [];
};
