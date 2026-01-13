export type AutomationEventKey =
  | 'issue'
  | 'commit'
  | 'merge_request'
  | (string & {});

export type AutomationClauseOp =
  | 'equals'
  | 'in'
  | 'containsAny'
  | 'matchesAny'
  | 'exists'
  | 'textContainsAny';

export interface AutomationClause {
  field: string;
  op: AutomationClauseOp;
  value?: string;
  values?: string[];
  negate?: boolean;
}

export interface AutomationMatch {
  /**
   * all: must satisfy all clauses
   * any: satisfy any clause
   * - if empty, treat as always matching
   */
  all?: AutomationClause[];
  any?: AutomationClause[];
}

export interface AutomationAction {
  id: string;
  robotId: string;
  enabled: boolean;
  /**
   * Full override: when set, `promptPatch` and the robot default template are ignored.
   */
  promptOverride?: string;
  /**
   * Patch: appended after the robot default template.
   */
  promptPatch?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  match?: AutomationMatch;
  actions: AutomationAction[];
}

export interface AutomationEventConfig {
  enabled: boolean;
  rules: AutomationRule[];
}

export interface RepoAutomationConfigV1 {
  version: 1;
  events: Record<string, AutomationEventConfig | undefined>;
}

export interface RepoAutomationConfigV2 {
  version: 2;
  events: Record<string, AutomationEventConfig | undefined>;
}

export type RepoAutomationConfig = RepoAutomationConfigV2 | RepoAutomationConfigV1;

export const SUPPORTED_AUTOMATION_EVENTS: Array<{ key: AutomationEventKey; label: string }> = [
  { key: 'issue', label: 'Issue' },
  { key: 'commit', label: 'Commit' },
  { key: 'merge_request', label: 'Merge Request' }
];
