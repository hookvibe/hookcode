// Group task-related API types into a dedicated module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type {
  ApprovalActionType,
  ApprovalRequestStatus,
  DependencyResult,
  PolicyDecision,
  PolicyRiskLevel,
  TaskEventType,
  TaskQueueDiagnosis,
  TaskStatus
} from './common';
import type { ModelProvider } from './models';
import type { RepoProvider, RobotPermission } from './repos';
import type { WorkerSummary } from './workers';

export interface TaskRepoSummary {
  id: string;
  provider: RepoProvider;
  name: string;
  enabled: boolean;
}

export interface TaskRobotSummary {
  id: string;
  // Surface robot scope so mixed repo/global task payloads remain explicit in the UI. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  scope: 'repo' | 'global';
  repoId?: string;
  name: string;
  permission: RobotPermission;
  // Expose robot model provider on task summaries for UI display. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
  modelProvider?: ModelProvider;
  enabled: boolean;
}

export interface PolicyEvaluationContext {
  repoId?: string;
  repoProvider?: string;
  robotId?: string;
  taskId?: string;
  taskGroupId?: string;
  eventType?: string;
  taskSource: string;
  provider?: string;
  sandbox?: string;
  networkAccess: boolean;
  commands: string[];
  targetFiles: string[];
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

export interface ApprovalMatchedRule {
  id?: string;
  name: string;
  action: PolicyDecision;
  source: 'policy_rule' | 'builtin';
}

export interface ApprovalRequestDetails {
  taskSource: string;
  provider?: string;
  sandbox: string;
  networkAccess: boolean;
  targetFiles: string[];
  commands: string[];
  reasons: string[];
  warnings?: string[];
  matchedRules: ApprovalMatchedRule[];
}

export interface ApprovalRequest {
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
  details?: ApprovalRequestDetails;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  actions: ApprovalActionRecord[];
  taskSummary?: {
    id: string;
    title?: string;
    status: string;
    repoId?: string;
    repoName?: string;
    robotId?: string;
    robotName?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface Task {
  id: string;
  groupId?: string;
  eventType: TaskEventType;
  status: TaskStatus;
  // Archived tasks are excluded from default lists and the worker queue. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
  payload?: unknown;
  promptCustom?: string;
  title?: string;
  projectId?: number;
  repoProvider?: RepoProvider;
  repoId?: string;
  robotId?: string;
  // Surface execution worker metadata in task payloads for attribution and routing. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId?: string;
  // Track the triggering user for notification routing. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  actorUserId?: string;
  ref?: string;
  mrId?: number;
  issueId?: number;
  retries: number;
  groupOrder?: number;
  sequence?: TaskSequenceLink;
  queue?: TaskQueueDiagnosis;
  result?: TaskResult;
  // Capture dependency install results for display/diagnostics. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult?: DependencyResult;
  workerLostAt?: string;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
  workerSummary?: WorkerSummary;
  approvalRequest?: ApprovalRequest;
  permissions?: { canManage: boolean };
}

export interface TaskGitStatusSnapshot {
  // Mirror backend git snapshot payload for UI rendering. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  branch: string;
  headSha: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  pushRemote?: string;
  pushWebUrl?: string;
}

export interface TaskGitStatusWorkingTree {
  // Track local file change lists for the task detail and group views. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface TaskGitStatusDelta {
  // Flag branch/head changes between baseline and final snapshots. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  branchChanged: boolean;
  headChanged: boolean;
}

export interface TaskGitStatusPushState {
  // Track push results for write-enabled robots (fork or upstream). docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  status: 'pushed' | 'unpushed' | 'unknown' | 'error' | 'not_applicable';
  reason?: string;
  targetBranch?: string;
  targetWebUrl?: string;
  targetHeadSha?: string;
}

export interface TaskGitStatus {
  // Provide git change tracking metadata for frontend rendering. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  enabled: boolean;
  capturedAt?: string;
  baseline?: TaskGitStatusSnapshot;
  final?: TaskGitStatusSnapshot;
  delta?: TaskGitStatusDelta;
  workingTree?: TaskGitStatusWorkingTree;
  push?: TaskGitStatusPushState;
  errors?: string[];
}

export type TaskWorkspaceChangeKind = 'create' | 'update' | 'delete' | (string & {});

export interface TaskWorkspaceChange {
  // Mirror backend workspace diff payloads so frontend diff panels can render task-scoped file changes. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  path: string;
  kind?: TaskWorkspaceChangeKind;
  unifiedDiff: string;
  oldText?: string;
  newText?: string;
  diffHash: string;
  updatedAt: string;
}

export interface TaskWorkspaceChanges {
  // Surface the latest repo-relative workspace change snapshot for live and historical task views. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  capturedAt: string;
  files: TaskWorkspaceChange[];
}

export type TaskWorkspaceSource = 'worker' | 'backend' | 'snapshot';
export type TaskWorkspaceFileSection = 'staged' | 'unstaged' | 'untracked';
export type TaskWorkspaceOperation = 'stage' | 'unstage' | 'discard' | 'delete_untracked' | 'commit';

export interface TaskWorkspaceFile extends TaskWorkspaceChange {
  sections: TaskWorkspaceFileSection[];
}

export interface TaskWorkspaceSummary {
  total: number;
  staged: number;
  unstaged: number;
  untracked: number;
  additions: number;
  deletions: number;
  hasChanges: boolean;
}

export interface TaskWorkspaceState {
  source: TaskWorkspaceSource;
  live: boolean;
  readOnly: boolean;
  capturedAt: string;
  branch?: string;
  headSha?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  workingTree: TaskGitStatusWorkingTree;
  summary: TaskWorkspaceSummary;
  files: TaskWorkspaceFile[];
  canCommit: boolean;
  fallbackReason?: string;
}

export interface TaskWorkspaceCommit {
  sha: string;
  message: string;
  committedAt: string;
}

export interface TaskWorkspaceOperationResult {
  workspace: TaskWorkspaceState;
  commit?: TaskWorkspaceCommit;
}

export interface TaskProviderRoutingCredential {
  requestedStoredSource: 'robot' | 'repo' | 'user';
  resolvedLayer: 'local' | 'robot' | 'repo' | 'user' | 'none';
  resolvedMethod:
    | 'env_api_key'
    | 'credentials_file'
    | 'auth_json_tokens'
    | 'auth_json_api_key'
    | 'oauth_creds'
    | 'robot_embedded'
    | 'repo_profile'
    | 'user_profile'
    | 'none';
  canExecute: boolean;
  profileId?: string;
  fallbackUsed: boolean;
  reason?: string;
}

export interface TaskProviderRoutingAttempt {
  provider: ModelProvider;
  role: 'primary' | 'fallback';
  status: 'planned' | 'skipped' | 'running' | 'succeeded' | 'failed';
  reason?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  credential: TaskProviderRoutingCredential;
}

export interface TaskProviderRouting {
  mode: 'fixed' | 'availability_first';
  failoverPolicy: 'disabled' | 'fallback_provider_once';
  primaryProvider: ModelProvider;
  fallbackProvider?: ModelProvider;
  selectedProvider: ModelProvider;
  finalProvider?: ModelProvider;
  selectionReason: string;
  failoverTriggered: boolean;
  attempts: TaskProviderRoutingAttempt[];
}

export interface TaskSequenceLink {
  // Mirror backend-derived queue links so the workspace can render explicit execution connectors. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  order: number;
  previousTaskId?: string;
  nextTaskId?: string;
}

export interface TaskResult {
  summary?: string;
  message?: string;
  stopReason?: 'manual_stop';
  stopRequestedAt?: string;
  // Legacy: logs were embedded in task results before log-table paging. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  logs?: string[];
  outputText?: string;
  providerCommentUrl?: string;
  providerRouting?: TaskProviderRouting;
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  policyDecision?: PolicyDecision;
  policyRiskLevel?: PolicyRiskLevel;
  // Surface backend git status in task result payloads for UI reuse. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  gitStatus?: TaskGitStatus;
  // Surface persisted workspace diff snapshots so diff panels survive reloads and history views. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  workspaceChanges?: TaskWorkspaceChanges | null;
  [key: string]: unknown;
}

// Represent paged task log payloads returned by the backend. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
export interface TaskLogsPage {
  logs: string[];
  startSeq: number;
  endSeq: number;
  nextBefore?: number;
}

// Change record: add `chat` to support console manual-trigger task groups.
export type TaskGroupKind = 'issue' | 'merge_request' | 'commit' | 'task' | 'chat';

export interface TaskGroup {
  id: string;
  kind: TaskGroupKind;
  bindingKey: string;
  threadId?: string | null;
  title?: string;
  repoProvider?: RepoProvider;
  repoId?: string;
  robotId?: string;
  // Keep task groups pinned to a worker once assigned so the workspace remains stable. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId?: string;
  issueId?: number;
  mrId?: number;
  commitSha?: string;
  skillSelections?: string[] | null; // Track task-group skill overrides for the chat UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  // Indicate whether a preview is currently running for the group. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
  previewActive?: boolean;
  // Flag task groups with processing tasks for sidebar running indicators. docs/en/developer/plans/taskgroup-running-dot-20260305/task_plan.md taskgroup-running-dot-20260305
  hasRunningTasks?: boolean;
  blockedByWorkerOffline?: boolean;
  // Archived groups are excluded from default sidebar/chat lists. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
  workerSummary?: WorkerSummary;
}

export interface TaskStatusStats {
  total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
}

export interface TaskVolumePoint {
  day: string;
  count: number;
}

export interface DashboardSidebarSnapshot {
  stats: TaskStatusStats;
  tasksByStatus: {
    queued: Task[];
    processing: Task[];
    success: Task[];
    failed: Task[];
  };
  taskGroups: TaskGroup[];
  // Provide a cursor to paginate sidebar task groups with load-more UX. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  taskGroupsNextCursor?: string;
  // Provide per-status cursors to load more tasks from the sidebar. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  tasksByStatusNextCursor?: {
    queued?: string;
    processing?: string;
    success?: string;
    failed?: string;
  };
}
