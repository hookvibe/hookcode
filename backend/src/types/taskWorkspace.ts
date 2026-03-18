import type { TaskGitStatusSnapshot, TaskGitStatusWorkingTree, TaskWorkspaceChangeKind } from './task';

export type TaskWorkspaceSource = 'worker' | 'backend' | 'snapshot';
export type TaskWorkspaceFileSection = 'staged' | 'unstaged' | 'untracked';
export type TaskWorkspaceOperation =
  | 'snapshot'
  | 'stage'
  | 'unstage'
  | 'discard'
  | 'delete_untracked'
  | 'commit';

export interface TaskWorkspaceFile {
  path: string;
  kind?: TaskWorkspaceChangeKind;
  sections: TaskWorkspaceFileSection[];
  unifiedDiff: string;
  oldText?: string;
  newText?: string;
  diffHash: string;
  updatedAt: string;
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

export interface TaskWorkspaceCommit {
  sha: string;
  message: string;
  committedAt: string;
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

export interface TaskWorkspaceOperationInput {
  paths?: string[];
  message?: string;
}

export interface TaskWorkspaceOperationResult {
  workspace: TaskWorkspaceState;
  commit?: TaskWorkspaceCommit;
}

export interface TaskWorkspaceSnapshotCapture {
  capturedAt: string;
  branch?: string;
  headSha?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  workingTree: TaskGitStatusWorkingTree;
  files: TaskWorkspaceFile[];
}

export interface TaskWorkspaceGitStatusView {
  snapshot?: TaskGitStatusSnapshot;
  workingTree: TaskGitStatusWorkingTree;
}
