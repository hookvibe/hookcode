import type { RepoProvider } from './repository';
import type { RobotPermission } from './repoRobot';

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
   * Redacted final output captured from `codex-output.txt`.
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
}

export interface Task {
  id: string;
  groupId?: string;
  eventType: TaskEventType;
  status: TaskStatus;
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
  result?: TaskResult;
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
