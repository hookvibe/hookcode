import type { RepoProvider } from './repository';
import type { RobotPermission } from './repoRobot';
import type { DependencyResult } from './dependency';
import type { TimeWindowSource } from './timeWindow';
import type { WorkerSummary } from './worker';
import type { ProviderRoutingResult } from '../providerRouting/providerRouting.types';
import type { ApprovalRequestRecord, PolicyDecision, PolicyRiskLevel } from '../policyEngine/types';
import type { BudgetGovernanceResult } from '../costGovernance/types';

// Keep a narrow task-status union while replacing pause/resume execution control with manual-stop failures. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
export type TaskStatus = 'queued' | 'waiting_approval' | 'processing' | 'succeeded' | 'failed' | 'commented';
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

export interface TaskGitStatusSnapshot {
  // Capture the repo ref state at a point in time (branch + head + upstream divergence). docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  branch: string;
  headSha: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  pushRemote?: string;
  pushWebUrl?: string;
}

export interface TaskGitStatusWorkingTree {
  // Surface local-only file changes for the UI (staged/unstaged/untracked). docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface TaskGitStatusDelta {
  // Compare baseline vs final to spot branch/commit changes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  branchChanged: boolean;
  headChanged: boolean;
}

export interface TaskGitStatusPushState {
  // Track whether new commits reached the push target (fork or upstream). docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  status: 'pushed' | 'unpushed' | 'unknown' | 'error' | 'not_applicable';
  reason?: string;
  targetBranch?: string;
  targetWebUrl?: string;
  targetHeadSha?: string;
}

export interface TaskGitStatus {
  // Store per-task git status snapshots to support UI change tracking. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  enabled: boolean;
  capturedAt?: string;
  baseline?: TaskGitStatusSnapshot;
  final?: TaskGitStatusSnapshot;
  delta?: TaskGitStatusDelta;
  workingTree?: TaskGitStatusWorkingTree;
  push?: TaskGitStatusPushState;
  errors?: string[];
}

export interface TaskSequenceLink {
  // Expose backend-derived queue links so the workspace can draw the execution path clearly. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  order: number;
  previousTaskId?: string;
  nextTaskId?: string;
}

// Include time-window gating as a first-class queue reason. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
export type TaskQueueReasonCode =
  | 'queue_backlog'
  | 'no_active_worker'
  | 'inline_worker_disabled'
  | 'outside_time_window'
  | 'unknown';

export interface TaskQueueTimeWindow {
  // Surface the resolved scheduling window so the UI can explain queued tasks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  startHour: number;
  endHour: number;
  source: TimeWindowSource;
  timezone: 'server';
}

export interface TaskQueueDiagnosis {
  reasonCode: TaskQueueReasonCode;
  /**
   * Number of queued tasks ahead of this task based on explicit queue order.
   */
  ahead: number;
  queuedTotal: number;
  processing: number;
  staleProcessing: number;
  inlineWorkerEnabled: boolean;
  // Attach time window context when tasks are blocked by schedule. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TaskQueueTimeWindow;
}

export interface TaskResult {
  grade?: 'A' | 'B' | 'C' | 'D';
  goLive?: boolean;
  summary?: string;
  risks?: string[];
  suggestions?: string[];
  message?: string;
  // Persist worker-loss metadata in task results so the UI can explain disconnected executors. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerLost?: boolean;
  workerLostReason?: string;
  code?: string;
  // Record manual stop requests and outcomes without reintroducing a resumable paused status. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  stopReason?: 'manual_stop';
  stopRequestedAt?: string;
  logs?: string[];
  /**
   * Monotonic log sequence number (total lines written so far).
   *
   * Legacy note:
   * - Sequence tracking now lives in the `task_logs` table.
   * - Keep this optional field in the type so old JSON payloads remain readable.
   */
  logsSeq?: number;
  /**
   * Accumulated token usage for this task execution.
   *
   * Notes:
   * - Derived from `codex exec --json` output (`turn.completed.usage`) during execution.
   * - Persisted incrementally so the console can display partial usage while the task is still running.
   */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /**
   * Redacted final output captured from provider output files (codex/claude/gemini) stored outside the repo. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
   * - Intended to be safe for broader visibility than raw execution logs.
   */
  outputText?: string;
  /**
   * Accessible URL for the platform-side posted message (Issue/MR/Commit comment):
   * - GitLab: typically `${project.web_url}/-/issues/:iid#note_:id` or `.../merge_requests/:iid#note_:id`
   * - GitHub: `html_url` returned by the comment API
   * - Used as a quick entry in the console for "view posted comment / jump to logs"
   */
  providerCommentUrl?: string;
  // Persist provider routing/failover decisions for task detail and task-group diagnostics. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
  providerRouting?: ProviderRoutingResult;
  // Persist budget/quota decisions and execution overrides for cost governance. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313
  costGovernance?: BudgetGovernanceResult;
  // Persist policy metadata so approval-gated tasks explain why they were blocked. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313
  policyDecision?: PolicyDecision;
  policyRiskLevel?: PolicyRiskLevel;
  /**
   * Repository workflow metadata for UI/debugging (direct clone vs fork-based PR/MR). 24yz61mdik7tqdgaa152
   */
  repoWorkflow?: {
    mode: 'direct' | 'fork';
    provider?: RepoProvider;
    upstream?: { slug?: string; webUrl?: string; cloneUrl?: string };
    fork?: { slug?: string; webUrl?: string; cloneUrl?: string };
  };
  // Persist git change/push status for write-enabled robots. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  gitStatus?: TaskGitStatus;
}

export interface Task {
  id: string;
  groupId?: string;
  eventType: TaskEventType;
  status: TaskStatus;
  /**
   * Archived tasks are excluded from the worker queue and default console lists. qnp1mtxhzikhbi0xspbc
   */
  archivedAt?: string;
  payload: unknown;
  /**
   * "Custom prompt snippet" used by this task (not rendered; supports `{{var}}` template variables).
   * - Computed and stored when the Webhook enqueues the task, based on repo event config + robot default template
   * - Rendered by promptBuilder during execution and appended to the final prompt
   */
  promptCustom?: string;
  title?: string;
  projectId?: number;
  repoProvider?: RepoProvider;
  repoId?: string;
  robotId?: string;
  // Surface the selected execution worker on each task for attribution and routing. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId?: string;
  // Persist task trigger ownership for notification routing. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  actorUserId?: string;
  ref?: string;
  mrId?: number;
  issueId?: number;
  retries: number;
  // Persist explicit queue order so the workspace can reorder queued tasks independently from timestamps. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  groupOrder?: number;
  sequence?: TaskSequenceLink;
  // Provide a best-effort explanation for long-waiting queued tasks in the console UI. f3a9c2d8e1b7f4a0c6d1
  queue?: TaskQueueDiagnosis;
  result?: TaskResult;
  // Persist dependency install outcomes for multi-language repos. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult?: DependencyResult;
  // Track worker-loss timestamps so the UI can explain worker-disconnect failures. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerLostAt?: string;
  createdAt: string;
  updatedAt: string;
}

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
  enabled: boolean;
}

export type TaskWithMeta = Task & {
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
  // Return compact worker metadata with task payloads so lists/details can show execution ownership. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerSummary?: WorkerSummary;
  // Attach the latest approval request so approval inbox/detail UIs can render inline context. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313
  approvalRequest?: ApprovalRequestRecord;
};
