import type { AuthUser } from '../auth';

// Split API type definitions into a dedicated module for reuse across API helpers. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export type ArchiveScope = 'active' | 'archived' | 'all'; // Keep archive filtering consistent with backend query params. qnp1mtxhzikhbi0xspbc

export type TaskStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'commented';
export type TaskQueueReasonCode =
  | 'queue_backlog'
  | 'no_active_worker'
  | 'inline_worker_disabled'
  | 'outside_time_window'
  | 'unknown';

// Shared hour-level time window shape for scheduling inputs. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
export interface TimeWindow {
  startHour: number;
  endHour: number;
}

export interface TaskQueueTimeWindow {
  // Provide time window metadata for queued task explanations. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  startHour: number;
  endHour: number;
  source: 'robot' | 'trigger' | 'chat';
  timezone: 'server';
}

export interface TaskQueueDiagnosis {
  // Surface queued-task diagnosis so the UI can explain long-waiting tasks. f3a9c2d8e1b7f4a0c6d1
  reasonCode: TaskQueueReasonCode;
  ahead: number;
  queuedTotal: number;
  processing: number;
  staleProcessing: number;
  inlineWorkerEnabled: boolean;
  timeWindow?: TaskQueueTimeWindow;
}

export interface DependencyInstallStep {
  // Dependency install steps returned by task APIs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  command?: string;
  workdir?: string;
  status: 'success' | 'skipped' | 'failed';
  duration?: number;
  error?: string;
  reason?: string;
}

export interface DependencyResult {
  status: 'success' | 'partial' | 'skipped' | 'failed';
  steps: DependencyInstallStep[];
  totalDuration: number;
}

export interface RuntimeInfo {
  // Runtime metadata returned by `/api/system/runtimes`. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  version: string;
  path: string;
  packageManager?: string;
}

export interface SystemRuntimesResponse {
  runtimes: RuntimeInfo[];
  detectedAt?: string;
}

export type TaskEventType =
  | 'issue'
  | 'commit'
  | 'merge_request'
  | 'issue_created'
  | 'issue_comment'
  | 'commit_review'
  | 'push'
  | 'note'
  | 'unknown'
  | (string & {});

export interface TaskRepoSummary {
  id: string;
  provider: RepoProvider;
  name: string;
  enabled: boolean;
}

export interface TaskRobotSummary {
  id: string;
  repoId: string;
  name: string;
  permission: RobotPermission;
  // Expose robot model provider on task summaries for UI display. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
  modelProvider?: ModelProvider;
  enabled: boolean;
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
  ref?: string;
  mrId?: number;
  issueId?: number;
  retries: number;
  queue?: TaskQueueDiagnosis;
  result?: TaskResult;
  // Capture dependency install results for display/diagnostics. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult?: DependencyResult;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
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

export interface TaskResult {
  summary?: string;
  message?: string;
  logs?: string[];
  outputText?: string;
  providerCommentUrl?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  // Surface backend git status in task result payloads for UI reuse. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  gitStatus?: TaskGitStatus;
  [key: string]: unknown;
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
  issueId?: number;
  mrId?: number;
  commitSha?: string;
  // Archived groups are excluded from default sidebar/chat lists. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
}

// Define preview API response types for TaskGroup dev server status. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export type PreviewInstanceStatus = 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

// Surface preview diagnostics and log payloads for Phase 3 UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewLogEntry {
  timestamp: string;
  level: 'stdout' | 'stderr' | 'system';
  message: string;
}

// Attach diagnostics to preview status payloads for failed/timeout sessions. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewDiagnostics {
  exitCode?: number | null;
  signal?: string | null;
  logs?: PreviewLogEntry[];
}

export interface PreviewInstanceSummary {
  name: string;
  status: PreviewInstanceStatus;
  port?: number;
  path?: string;
  // Expose preview subdomain URLs when configured. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  publicUrl?: string;
  message?: string;
  diagnostics?: PreviewDiagnostics;
}

export interface PreviewStatusResponse {
  available: boolean;
  instances: PreviewInstanceSummary[];
  reason?: 'config_missing' | 'config_invalid' | 'workspace_missing' | 'invalid_group' | 'missing_task';
}

// Describe highlight commands sent to preview bridge scripts. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export type PreviewHighlightMode = 'outline' | 'mask';

// Define bubble tooltip payloads for preview highlight commands. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
export type PreviewHighlightBubblePlacement = 'top' | 'right' | 'bottom' | 'left' | 'auto';
export type PreviewHighlightBubbleAlign = 'start' | 'center' | 'end';
export type PreviewHighlightBubbleTheme = 'dark' | 'light';

export interface PreviewHighlightBubble {
  text: string;
  placement?: PreviewHighlightBubblePlacement;
  align?: PreviewHighlightBubbleAlign;
  offset?: number;
  maxWidth?: number;
  theme?: PreviewHighlightBubbleTheme;
  background?: string;
  textColor?: string;
  borderColor?: string;
  radius?: number;
  arrow?: boolean;
}

export interface PreviewHighlightCommand {
  selector: string;
  padding?: number;
  color?: string;
  mode?: PreviewHighlightMode;
  scrollIntoView?: boolean;
  // Carry optional bubble tooltip data alongside highlight commands. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  bubble?: PreviewHighlightBubble;
  requestId?: string;
}

// Preview highlight events delivered over SSE. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewHighlightEvent {
  taskGroupId: string;
  instanceName: string;
  command: PreviewHighlightCommand;
  issuedAt: string;
}

// Shape repo preview config responses for the repo detail dashboard. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface RepoPreviewInstanceSummary {
  name: string;
  workdir: string;
}

export interface RepoPreviewConfigResponse {
  available: boolean;
  instances: RepoPreviewInstanceSummary[];
  reason?: 'no_workspace' | 'config_missing' | 'config_invalid' | 'workspace_missing';
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
}

export interface AuthMeResponse {
  authEnabled: boolean;
  user: AuthUser | null;
  features?: { taskLogsEnabled?: boolean };
  token?: { iat: number; exp: number };
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
  roles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserModelCredentialsPublic {
  codex: UserModelProviderCredentialsPublic;
  claude_code: UserModelProviderCredentialsPublic;
  gemini_cli: UserModelProviderCredentialsPublic;
  gitlab: UserRepoProviderCredentialsPublic;
  github: UserRepoProviderCredentialsPublic;
  [key: string]: any;
}

export interface UserModelProviderCredentialProfilePublic {
  id: string;
  remark: string;
  apiBaseUrl?: string;
  hasApiKey: boolean;
}

export interface UserModelProviderCredentialsPublic {
  profiles: UserModelProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export interface UserRepoProviderCredentialProfilePublic {
  id: string;
  remark: string;
  hasToken: boolean;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentialsPublic {
  profiles: UserRepoProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

// PAT scope types for API access tokens. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export type ApiTokenScopeGroup = 'account' | 'repos' | 'tasks' | 'events' | 'system';
export type ApiTokenScopeLevel = 'read' | 'write';

export interface ApiTokenScope {
  group: ApiTokenScopeGroup;
  level: ApiTokenScopeLevel;
}

export interface UserApiTokenPublic {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenLast4?: string | null;
  scopes: ApiTokenScope[];
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
}

export type ModelProviderModelsSource = 'remote' | 'fallback';

export interface ModelProviderModelsResponse {
  models: string[];
  source: ModelProviderModelsSource;
}

export interface ModelProviderModelsRequest {
  provider: ModelProvider;
  profileId?: string;
  credential?: { apiBaseUrl?: string | null; apiKey?: string | null } | null;
  forceRefresh?: boolean;
}

export interface AdminToolsMeta {
  enabled: boolean;
  ports: {
    prisma: number;
    swagger: number;
  };
}

export type RepoProvider = 'gitlab' | 'github';

export interface RepositoryBranch {
  name: string;
  note?: string;
  isDefault?: boolean;
}

export interface Repository {
  id: string;
  provider: RepoProvider;
  name: string;
  externalId?: string;
  apiBaseUrl?: string;
  webhookVerifiedAt?: string;
  // Archived repositories are hidden from default lists and block new automation/tasks. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
  branches?: RepositoryBranch[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RobotPermission = 'read' | 'write';

export type ModelProvider = 'codex' | 'claude_code' | 'gemini_cli' | (string & {});

// Accept any Codex model id to support dynamic model discovery without hardcoded unions. b8fucnmey62u0muyn7i0
export type CodexModel = string;
export type CodexSandbox = 'workspace-write' | 'read-only';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface CodexRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  /**
   * Selected credential profile id when `credentialSource` is `user` or `repo`.
   *
   * Notes:
   * - Backend validates the existence and `hasApiKey` state for the chosen profile.
   */
  credentialProfileId?: string;
  /**
   * Inline robot credential (write-only for `apiKey`, safe for display for other fields).
   *
   * Notes:
   * - Only present when `credentialSource` is `robot`.
   */
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: CodexModel;
  sandbox: CodexSandbox;
  // Codex network access is always enabled and no longer part of the config payload. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
  model_reasoning_effort: CodexReasoningEffort;
}

export type ClaudeCodeSandbox = 'workspace-write' | 'read-only';

export interface ClaudeCodeRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credentialProfileId?: string;
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: string;
  sandbox: ClaudeCodeSandbox;
  sandbox_workspace_write: { network_access: boolean };
}

export type GeminiCliSandbox = 'workspace-write' | 'read-only';

export interface GeminiCliRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credentialProfileId?: string;
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: string;
  sandbox: GeminiCliSandbox;
  sandbox_workspace_write: { network_access: boolean };
}

export interface RepoScopedCredentialsPublic {
  // Business intent: repo-scoped credentials use the same "profile" shape as account credentials,
  // so the UI can reuse the same components for listing/editing defaults.
  repoProvider: UserRepoProviderCredentialsPublic;
  modelProvider: {
    codex: UserModelProviderCredentialsPublic;
    claude_code: UserModelProviderCredentialsPublic;
    gemini_cli: UserModelProviderCredentialsPublic;
  };
}

export interface RepoRobot {
  id: string;
  repoId: string;
  name: string;
  permission: RobotPermission;
  hasToken: boolean;
  repoCredentialSource?: 'robot' | 'user' | 'repo';
  repoCredentialProfileId?: string;
  repoCredentialRemark?: string;
  cloneUsername?: string;
  repoTokenUserId?: string;
  repoTokenUsername?: string;
  repoTokenUserName?: string;
  repoTokenUserEmail?: string;
  repoTokenRepoRole?: string;
  repoTokenRepoRoleDetails?: unknown;
  promptDefault?: string;
  language?: string;
  modelProvider?: ModelProvider;
  modelProviderConfig?: CodexRobotProviderConfigPublic | ClaudeCodeRobotProviderConfigPublic | GeminiCliRobotProviderConfigPublic;
  // Dependency overrides for multi-language installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyConfig?: { enabled?: boolean; failureMode?: 'soft' | 'hard'; allowCustomInstall?: boolean };
  defaultBranch?: string;
  // Compatibility: legacy field.
  defaultBranchRole?: 'main' | 'dev' | 'test';
  // Repo workflow mode selection (auto/direct/fork). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  repoWorkflowMode?: 'auto' | 'direct' | 'fork';
  // Optional hour-level execution window for this robot. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow;
  activatedAt?: string;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export type RepoProviderVisibility = 'public' | 'private' | 'internal' | 'unknown';

export interface RepoProviderActivityItem {
  id: string;
  shortId?: string;
  title: string;
  url?: string;
  state?: string;
  time?: string;
  taskGroups?: Array<{
    id: string;
    kind: string;
    title?: string;
    updatedAt: string;
    processingTasks?: Array<{ id: string; status: string; title?: string; updatedAt?: string }>;
  }>;
}

export interface RepoProviderActivityPage {
  items: RepoProviderActivityItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface RepoProviderActivity {
  provider: RepoProvider;
  commits: RepoProviderActivityPage;
  merges: RepoProviderActivityPage;
  issues: RepoProviderActivityPage;
}

export type RepoCredentialProfileStatus = 'ready' | 'missing_repo_token' | 'missing_clone_username';

export interface RepoCredentialProfile {
  id: string;
  repoId: string;
  name: string;
  status: RepoCredentialProfileStatus;
  cloneUsername?: string;
  hasToken: boolean;
  createdAt: string;
  updatedAt: string;
}
