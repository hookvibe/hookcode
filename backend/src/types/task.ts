import type { RepoProvider } from './repository';
import type { RobotPermission } from './repoRobot';
import type { DependencyResult } from './dependency';

export type TaskStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'commented';

/**
 * Internal event types (extensible):
 * - Currently mainly used: issue / commit / merge_request (distinguish created/commented/updated via `payload.__subType`)
 * - Kept for legacy compatibility: issue_created / issue_comment / commit_review / push / note
 */
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

export interface TaskResult {
  grade?: 'A' | 'B' | 'C' | 'D';
  goLive?: boolean;
  summary?: string;
  risks?: string[];
  suggestions?: string[];
  message?: string;
  logs?: string[];
  /**
   * Monotonic log sequence number (total lines written so far).
   * - Used by SSE DB polling to stream new log lines even when `logs[]` is capped and older lines are dropped.
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

export type TaskQueueReasonCode = 'queue_backlog' | 'no_active_worker' | 'inline_worker_disabled' | 'unknown';

export interface TaskQueueDiagnosis {
  reasonCode: TaskQueueReasonCode;
  /**
   * Number of queued tasks ahead of this task (FIFO by `created_at`).
   */
  ahead: number;
  queuedTotal: number;
  processing: number;
  staleProcessing: number;
  inlineWorkerEnabled: boolean;
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
  ref?: string;
  mrId?: number;
  issueId?: number;
  retries: number;
  // Provide a best-effort explanation for long-waiting queued tasks in the console UI. f3a9c2d8e1b7f4a0c6d1
  queue?: TaskQueueDiagnosis;
  result?: TaskResult;
  // Persist dependency install outcomes for multi-language repos. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult?: DependencyResult;
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
};
