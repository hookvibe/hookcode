export type PolicyDecision = 'allow' | 'allow_with_warning' | 'require_approval' | 'deny';

export type PolicyRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = PolicyRiskLevel;

export type PolicyTaskSource = 'webhook' | 'chat' | 'manual' | 'dry_run' | 'system' | (string & {});
export type TaskPolicySource = PolicyTaskSource;

export type PolicySandbox = 'read-only' | 'workspace-write' | 'danger-full-access' | 'unknown' | (string & {});

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type ApprovalActionType =
  | 'requested'
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'approve_once'
  | 'approve_always'
  | 'approve_always_robot'
  | 'approve_always_rule';

export type ApprovalDecisionMode = 'once' | 'always_for_robot' | 'always_for_rule';

export interface PolicyRuleConditions {
  providers?: string[];
  sandboxes?: string[];
  taskSources?: PolicyTaskSource[];
  networkAccess?: boolean;
  riskLevels?: PolicyRiskLevel[];
  repoProviders?: string[];
  eventTypes?: string[];
  commandPatterns?: string[];
  targetFilePatterns?: string[];
  // Legacy alias kept for compatibility with earlier rule payloads.
  targetPathPatterns?: string[];
}

export interface PolicyRuleRecord {
  id: string;
  repoId?: string;
  robotId?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  name: string;
  enabled: boolean;
  priority: number;
  action: PolicyDecision;
  conditions: PolicyRuleConditions;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyEvaluationContext {
  repoId?: string;
  repoProvider?: string;
  robotId?: string;
  taskId?: string;
  taskGroupId?: string;
  eventType?: string;
  taskSource: PolicyTaskSource;
  provider?: string;
  sandbox?: PolicySandbox;
  networkAccess: boolean;
  commands: string[];
  targetFiles: string[];
}

export interface PolicyTaskContext {
  taskId: string;
  repoId?: string;
  repoProvider?: string;
  robotId?: string;
  actorUserId?: string;
  eventType?: string;
  taskSource: PolicyTaskSource;
  provider?: string;
  sandbox: PolicySandbox;
  networkAccess: boolean;
  textCorpus: string;
  targetFiles: string[];
  commands: string[];
}

export interface PolicyMatchedRule {
  id?: string;
  name: string;
  action: PolicyDecision;
  source: 'policy_rule' | 'builtin';
}

export interface PolicyEvaluationDetails {
  taskSource: PolicyTaskSource;
  provider?: string;
  sandbox: PolicySandbox;
  networkAccess: boolean;
  targetFiles: string[];
  commands: string[];
  reasons: string[];
  warnings: string[];
  matchedRules: PolicyMatchedRule[];
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  riskLevel: PolicyRiskLevel;
  summary: string;
  details: PolicyEvaluationDetails;
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  riskLevel: PolicyRiskLevel;
  reasons: string[];
  warnings: string[];
  matchedRule?: PolicyRuleRecord;
  context: PolicyEvaluationContext;
}

export interface TaskPolicyEvaluationSummary {
  decision: PolicyDecision;
  riskLevel: PolicyRiskLevel;
  reasons: string[];
  warnings?: string[];
  matchedRuleId?: string;
  matchedRuleName?: string;
  evaluatedAt: string;
  context: PolicyEvaluationContext;
}

export interface ApprovalActionRecord {
  id: string;
  approvalRequestId: string;
  actorUserId?: string;
  action: ApprovalActionType;
  note?: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface ApprovalRequestRecord {
  id: string;
  taskId: string;
  repoId?: string;
  robotId?: string;
  requestedByUserId?: string;
  resolvedByUserId?: string;
  status: ApprovalRequestStatus;
  decision: PolicyDecision;
  riskLevel: PolicyRiskLevel;
  summary: string;
  details?: PolicyEvaluationDetails;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  actions: ApprovalActionRecord[];
}

export interface ApprovalTaskSummary {
  id: string;
  title?: string;
  status: string;
  repoId?: string;
  repoName?: string;
  robotId?: string;
  robotName?: string;
  createdAt: string;
  updatedAt: string;
}
