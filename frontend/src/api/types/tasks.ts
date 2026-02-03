// Group task-related API types into a dedicated module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { DependencyResult, TaskEventType, TaskQueueDiagnosis, TaskStatus } from './common';
import type { ModelProvider } from './models';
import type { RepoProvider, RobotPermission } from './repos';

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
