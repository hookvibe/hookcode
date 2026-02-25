// Extract automation and webhook delivery types for reuse across repo automation UI. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { TimeWindow } from './common';
import type { RepoProvider } from './repos';

export type AutomationEventKey = 'issue' | 'commit' | 'merge_request' | (string & {});

export type AutomationClauseOp = 'equals' | 'in' | 'containsAny' | 'matchesAny' | 'exists' | 'textContainsAny';

export interface AutomationClause {
  field: string;
  op: AutomationClauseOp;
  value?: string;
  values?: string[];
  negate?: boolean;
}

export interface AutomationMatch {
  all?: AutomationClause[];
  any?: AutomationClause[];
}

export interface AutomationAction {
  id: string;
  robotId: string;
  enabled: boolean;
  promptOverride?: string;
  promptPatch?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  match?: AutomationMatch;
  actions: AutomationAction[];
  // Trigger-level scheduling window for this rule. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow;
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

export type RepoAutomationConfig = RepoAutomationConfigV1 | RepoAutomationConfigV2;

export type RepoWebhookDeliveryResult = 'accepted' | 'skipped' | 'rejected' | 'error';

export interface RepoWebhookDeliverySummary {
  id: string;
  repoId: string;
  provider: RepoProvider;
  eventName?: string;
  deliveryId?: string;
  result: RepoWebhookDeliveryResult;
  httpStatus: number;
  code?: string;
  message?: string;
  taskIds: string[];
  createdAt: string;
}

export interface RepoWebhookDeliveryDetail extends RepoWebhookDeliverySummary {
  payload?: unknown;
  response?: unknown;
}
