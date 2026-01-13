import type { RepoProvider } from './repository';
import type { TaskRepoSummary, TaskRobotSummary } from './task';

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
  issueId?: number;
  mrId?: number;
  commitSha?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskGroupWithMeta = TaskGroup & {
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
};
