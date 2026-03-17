import { Injectable } from '@nestjs/common';
import {
  buildTaskGroupWorkspaceDir,
  getRepoSlug
} from '../../agent/agent';
import type { Task, TaskGitStatus, TaskResult } from '../../types/task';
import type {
  TaskWorkspaceOperation,
  TaskWorkspaceOperationInput,
  TaskWorkspaceOperationResult,
  TaskWorkspaceState
} from '../../types/taskWorkspace';
import { computeGitPushState, computeGitStatusDelta } from '../../utils/gitStatus';
import { WorkersConnectionService } from '../workers/workers-connection.service';
import { WorkersService } from '../workers/workers.service';
import { LocalTaskWorkspaceError, collectLocalTaskWorkspace, executeLocalTaskWorkspaceOperation } from './task-workspace.local';
import { TaskService } from './task.service';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export class TaskWorkspaceServiceError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'TaskWorkspaceServiceError';
  }
}

const countDiffStats = (unifiedDiff: string): { additions: number; deletions: number } => {
  const lines = String(unifiedDiff ?? '').split(/\r?\n/);
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (!line || line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
    if (line.startsWith('+')) additions += 1;
    if (line.startsWith('-')) deletions += 1;
  }
  return { additions, deletions };
};

@Injectable()
export class TaskWorkspaceService {
  constructor(
    private readonly taskService: TaskService,
    private readonly workersService: WorkersService,
    private readonly workersConnections: WorkersConnectionService
  ) {}

  async getWorkspace(taskId: string): Promise<TaskWorkspaceState> {
    const task = await this.requireTask(taskId);
    const live = await this.tryLoadLiveWorkspace(task);
    if (live) return live;

    const snapshot = this.buildSnapshotWorkspace(task);
    if (snapshot) return snapshot;

    throw new TaskWorkspaceServiceError('WORKSPACE_UNAVAILABLE', 'Task workspace is unavailable');
  }

  async runOperation(taskId: string, action: TaskWorkspaceOperation, input?: TaskWorkspaceOperationInput): Promise<TaskWorkspaceOperationResult> {
    const task = await this.requireTask(taskId);
    if (task.status === 'processing') {
      throw new TaskWorkspaceServiceError('WORKSPACE_READONLY', 'Workspace actions are disabled while the task is still running');
    }

    const worker = task.workerId ? await this.workersService.getWorkerById(task.workerId) : null;
    if (worker && this.workersConnections.hasConnection(worker.id)) {
      try {
        const raw = await this.workersConnections.requestWorkspaceOperation(worker.id, {
          taskId: task.id,
          action,
          payload: input
        });
        const result = this.parseWorkerOperationResult(raw);
        await this.persistWorkspace(task, result.workspace);
        return result;
      } catch (error) {
        if (!worker.systemManaged || worker.kind !== 'local') {
          throw new TaskWorkspaceServiceError('WORKSPACE_REMOTE_FAILED', error instanceof Error ? error.message : 'Worker workspace request failed');
        }
      }
    }

    if (worker?.systemManaged && worker.kind === 'local') {
      const repoDir = this.resolveBackendWorkspaceDir(task);
      try {
        const result = await executeLocalTaskWorkspaceOperation({
          repoDir,
          action,
          paths: input?.paths,
          message: input?.message
        });
        await this.persistWorkspace(task, result.workspace);
        return result;
      } catch (error) {
        if (error instanceof LocalTaskWorkspaceError) {
          throw new TaskWorkspaceServiceError(error.code, error.message);
        }
        throw error;
      }
    }

    throw new TaskWorkspaceServiceError('WORKSPACE_READONLY', 'Live task workspace is not available for write actions');
  }

  private async requireTask(taskId: string): Promise<Task> {
    const task = await this.taskService.getTask(taskId);
    if (!task) {
      throw new TaskWorkspaceServiceError('TASK_NOT_FOUND', 'Task not found');
    }
    return task;
  }

  private async tryLoadLiveWorkspace(task: Task): Promise<TaskWorkspaceState | null> {
    const worker = task.workerId ? await this.workersService.getWorkerById(task.workerId) : null;
    if (worker && this.workersConnections.hasConnection(worker.id)) {
      try {
        const raw = await this.workersConnections.requestWorkspaceOperation(worker.id, {
          taskId: task.id,
          action: 'snapshot'
        });
        return this.parseWorkerOperationResult(raw).workspace;
      } catch (error) {
        if (!worker.systemManaged || worker.kind !== 'local') {
          return null;
        }
      }
    }

    if (worker?.systemManaged && worker.kind === 'local') {
      try {
        return await collectLocalTaskWorkspace(this.resolveBackendWorkspaceDir(task));
      } catch (error) {
        if (error instanceof LocalTaskWorkspaceError) {
          return null;
        }
        throw error;
      }
    }

    return null;
  }

  private resolveBackendWorkspaceDir(task: Task): string {
    const provider = (task.repoProvider ?? 'gitlab') as 'gitlab' | 'github';
    const repoSlug = getRepoSlug(provider, task.payload ?? {}, task.id);
    return buildTaskGroupWorkspaceDir({
      taskGroupId: task.groupId,
      taskId: task.id,
      provider,
      repoSlug
    });
  }

  private buildSnapshotWorkspace(task: Task): TaskWorkspaceState | null {
    const result = (task.result ?? {}) as TaskResult;
    const workspaceChanges = result.workspaceChanges;
    const gitStatus = result.gitStatus;
    const files = Array.isArray(workspaceChanges?.files) ? workspaceChanges.files : [];
    if (!files.length && !gitStatus?.workingTree) return null;

    let additions = 0;
    let deletions = 0;
    for (const file of files) {
      const stats = countDiffStats(file.unifiedDiff);
      additions += stats.additions;
      deletions += stats.deletions;
    }

    const workingTree = gitStatus?.workingTree ?? { staged: [], unstaged: [], untracked: [] };
    return {
      source: 'snapshot',
      live: false,
      readOnly: true,
      capturedAt: trimString(workspaceChanges?.capturedAt) || trimString(gitStatus?.capturedAt) || task.updatedAt,
      branch: trimString(gitStatus?.final?.branch) || trimString(gitStatus?.baseline?.branch) || undefined,
      headSha: trimString(gitStatus?.final?.headSha) || trimString(gitStatus?.baseline?.headSha) || undefined,
      upstream: trimString(gitStatus?.final?.upstream) || trimString(gitStatus?.baseline?.upstream) || undefined,
      ahead: gitStatus?.final?.ahead,
      behind: gitStatus?.final?.behind,
      workingTree,
      summary: {
        total: files.length,
        staged: workingTree.staged.length,
        unstaged: workingTree.unstaged.length,
        untracked: workingTree.untracked.length,
        additions,
        deletions,
        hasChanges: files.length > 0
      },
      files: files.map((file) => ({
        ...file,
        sections: [
          ...(workingTree.staged.includes(file.path) ? (['staged'] as const) : []),
          ...(workingTree.unstaged.includes(file.path) ? (['unstaged'] as const) : []),
          ...(workingTree.untracked.includes(file.path) ? (['untracked'] as const) : [])
        ]
      })),
      canCommit: false,
      fallbackReason: 'snapshot'
    };
  }

  private parseWorkerOperationResult(raw: Record<string, unknown>): TaskWorkspaceOperationResult {
    const workspace = (raw.workspace ?? null) as TaskWorkspaceState | null;
    if (!workspace || typeof workspace !== 'object') {
      throw new TaskWorkspaceServiceError('WORKSPACE_INVALID_RESPONSE', 'Worker returned an invalid workspace payload');
    }
    return {
      workspace,
      commit: raw.commit as TaskWorkspaceOperationResult['commit']
    };
  }

  private async persistWorkspace(task: Task, workspace: TaskWorkspaceState): Promise<void> {
    const result = (task.result ?? {}) as TaskResult;
    const existingGitStatus = result.gitStatus;
    const nextSnapshot =
      workspace.branch && workspace.headSha
        ? {
            branch: workspace.branch,
            headSha: workspace.headSha,
            upstream: workspace.upstream,
            ahead: workspace.ahead,
            behind: workspace.behind,
            pushRemote: existingGitStatus?.final?.pushRemote ?? existingGitStatus?.baseline?.pushRemote,
            pushWebUrl: existingGitStatus?.final?.pushWebUrl ?? existingGitStatus?.baseline?.pushWebUrl
          }
        : existingGitStatus?.final ?? existingGitStatus?.baseline;

    const delta = nextSnapshot ? computeGitStatusDelta(existingGitStatus?.baseline, nextSnapshot) : existingGitStatus?.delta ?? null;
    const pushState =
      nextSnapshot && existingGitStatus?.push
        ? {
            ...computeGitPushState({
              delta,
              final: nextSnapshot,
              pushTargetSha: existingGitStatus.push.targetHeadSha
            }),
            targetBranch: existingGitStatus.push.targetBranch ?? nextSnapshot.branch,
            targetWebUrl: existingGitStatus.push.targetWebUrl ?? nextSnapshot.pushWebUrl,
            targetHeadSha: existingGitStatus.push.targetHeadSha
          }
        : existingGitStatus?.push;

    const nextGitStatus: TaskGitStatus = {
      enabled: true,
      capturedAt: workspace.capturedAt,
      baseline: existingGitStatus?.baseline,
      final: nextSnapshot,
      delta: delta ?? undefined,
      workingTree: workspace.workingTree,
      push: pushState,
      errors: existingGitStatus?.errors
    };

    await this.taskService.updateResult(task.id, {
      gitStatus: nextGitStatus,
      workspaceChanges: workspace.files.length
        ? {
            capturedAt: workspace.capturedAt,
            files: workspace.files.map((file) => ({
              path: file.path,
              kind: file.kind,
              unifiedDiff: file.unifiedDiff,
              oldText: file.oldText,
              newText: file.newText,
              diffHash: file.diffHash,
              updatedAt: file.updatedAt
            }))
          }
        : null
    });
  }
}
