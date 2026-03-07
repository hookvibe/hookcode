import type { RepoProvider } from './repository';
import type { TaskRepoSummary, TaskRobotSummary } from './task';
import type { WorkerSummary } from './worker';

// Business context (Tasks/Task Groups):
// - `chat` is a console-only "manual trigger" group type (no webhook required).
// - Change record: add `chat` kind so frontend/backend can render and filter chat-created groups consistently.
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
  // Keep task groups pinned to a worker once execution starts to preserve workspace continuity. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId?: string;
  issueId?: number;
  mrId?: number;
  commitSha?: string;
  skillSelections?: string[] | null; // Track task-group skill selections (null = inherit repo defaults). docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  // Surface preview activity in sidebar/task-group lists. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
  previewActive?: boolean;
  // Surface running-task status for sidebar activity dots. docs/en/developer/plans/taskgroup-running-dot-20260305/task_plan.md taskgroup-running-dot-20260305
  hasRunningTasks?: boolean;
  // Flag task groups that are blocked because their assigned worker is offline. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  blockedByWorkerOffline?: boolean;
  /**
   * Archived groups are excluded from default sidebar/chat lists. qnp1mtxhzikhbi0xspbc
   */
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskGroupWithMeta = TaskGroup & {
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
  // Return compact worker metadata with task-group payloads for list/detail routing. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerSummary?: WorkerSummary;
};
