import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { stat } from 'fs/promises';
import path from 'path';
import {
  BUILD_ROOT,
  collectGitStatusSnapshot,
  getRepoCloneUrl,
  getRepoSlug,
  injectBasicAuth,
  resolveCheckoutRef,
  resolveExecution,
  runCommandCapture,
  shDoubleQuote
} from '../../agent/agent';
import { getGitCloneAuth, inferRobotRepoProviderCredentialSource } from '../../services/repoRobotAccess';
import type { TaskGitStatus, TaskResult, TaskWithMeta } from '../../types/task';
import { computeGitPushState, computeGitStatusDelta } from '../../utils/gitStatus';
import { GIT_CONFIG_KEYS, normalizeGitRemoteUrl } from '../../utils/gitWorkflow';
import { AgentService } from './agent.service';
import { TaskService } from './task.service';

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

@Injectable()
export class TaskGitPushService {
  constructor(private readonly taskService: TaskService, private readonly agentService: AgentService) {}

  async pushTask(taskId: string): Promise<TaskWithMeta> {
    // Enforce git push guards (fork + unpushed + write permission) before executing commands. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    void this.agentService; // Ensure agent services are initialized before resolveExecution. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const task = await this.taskService.getTask(taskId);
    if (!task) {
      throw new NotFoundException({ error: 'Task not found' });
    }

    const result = (task.result ?? {}) as TaskResult;
    // Validate push eligibility and return stable error codes for UI messaging. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const gitStatus = result.gitStatus;
    if (!gitStatus?.enabled) {
      throw new ConflictException({ error: 'Git status unavailable', code: 'GIT_STATUS_UNAVAILABLE' });
    }
    if (gitStatus.push?.status !== 'unpushed') {
      throw new ConflictException({ error: 'No unpushed changes', code: 'GIT_PUSH_NOT_NEEDED' });
    }
    if (result.repoWorkflow?.mode !== 'fork') {
      throw new ConflictException({ error: 'Push is only allowed for fork workflows', code: 'GIT_PUSH_NOT_FORK' });
    }
    // Require a captured head SHA so pushes map to the task's recorded commit. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const capturedHeadSha = safeTrim(gitStatus.final?.headSha);
    if (!capturedHeadSha) {
      throw new ConflictException({ error: 'Missing captured commit for this task', code: 'GIT_PUSH_MISSING_HEAD' });
    }

    const payload: any = task.payload ?? {};
    const execution = await resolveExecution(task, payload, async () => undefined);
    if (execution.robot.permission !== 'write') {
      throw new ForbiddenException({ error: 'Robot is not allowed to push', code: 'GIT_PUSH_FORBIDDEN' });
    }

    const branchHint = safeTrim(gitStatus.final?.branch || gitStatus.baseline?.branch);
    const checkout = resolveCheckoutRef({ task, payload, repo: execution.repo, robot: execution.robot });
    const ref = branchHint && branchHint !== 'HEAD' ? branchHint : checkout.ref;
    const refSlug = ref ? ref.replace(/[^\w.-]/g, '_') : 'default';
    const repoSlug = getRepoSlug(execution.provider, payload, task.id);
    const repoDir = path.join(BUILD_ROOT, `${execution.provider}__${repoSlug}__${refSlug}`);

    try {
      await stat(repoDir);
    } catch {
      throw new ConflictException({ error: 'Task workspace is missing; re-run the task first', code: 'GIT_PUSH_WORKSPACE_MISSING' });
    }

    const gitEnv = { GIT_TERMINAL_PROMPT: '0' };
    const runGit = (cmd: string) =>
      runCommandCapture(`cd ${shDoubleQuote(repoDir)} && ${cmd}`, { env: gitEnv });

    const upstreamCloneUrl =
      safeTrim(result.repoWorkflow?.upstream?.cloneUrl) || safeTrim(getRepoCloneUrl(execution.provider, payload));
    const pushCloneUrl = safeTrim(result.repoWorkflow?.fork?.cloneUrl) || upstreamCloneUrl;

    if (pushCloneUrl) {
      // Refresh push URL + guard keys so pushes use the fork target and stay consistent. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const source = inferRobotRepoProviderCredentialSource(execution.robot);
      const auth = getGitCloneAuth({
        provider: execution.provider,
        robot: execution.robot,
        userCredentials: execution.userCredentials,
        repoCredentials: execution.repoScopedCredentials?.repoProvider ?? null,
        source
      });
      const execUrl = auth ? injectBasicAuth(pushCloneUrl, auth).execUrl : pushCloneUrl;
      await runGit(`git remote set-url --push origin ${shDoubleQuote(execUrl)}`);
      if (upstreamCloneUrl) {
        await runGit(
          `git config --local ${shDoubleQuote(GIT_CONFIG_KEYS.upstream)} ${shDoubleQuote(upstreamCloneUrl)} && git config --local ${shDoubleQuote(GIT_CONFIG_KEYS.push)} ${shDoubleQuote(pushCloneUrl)}`
        );
      }
    }

    // Block pushes when the workspace head drifted from the task snapshot. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const headRes = await runGit('git rev-parse HEAD');
    const headSha = headRes.exitCode === 0 ? headRes.stdout.trim() : '';
    if (!headSha) {
      const next = this.buildPushFailureStatus(gitStatus, 'head_unavailable', 'push: head_unavailable');
      await this.taskService.updateResult(task.id, { gitStatus: next });
      throw new ConflictException({ error: 'Unable to resolve repository HEAD', code: 'GIT_PUSH_HEAD_UNAVAILABLE' });
    }
    if (headSha !== capturedHeadSha) {
      const next = this.buildPushFailureStatus(gitStatus, 'head_mismatch', 'push: head_mismatch');
      await this.taskService.updateResult(task.id, { gitStatus: next });
      throw new ConflictException({ error: 'Task workspace head has changed; re-run the task', code: 'GIT_PUSH_HEAD_MISMATCH' });
    }

    if (pushCloneUrl) {
      // Validate the push remote to avoid silently pushing to the wrong fork. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const pushRemoteRes = await runGit('git remote get-url --push origin');
      const pushRemoteRaw = pushRemoteRes.exitCode === 0 ? pushRemoteRes.stdout.trim() : '';
      const normalizedRemote = normalizeGitRemoteUrl(pushRemoteRaw);
      const normalizedExpected = normalizeGitRemoteUrl(pushCloneUrl);
      if (normalizedRemote && normalizedExpected && normalizedRemote !== normalizedExpected) {
        const next = this.buildPushFailureStatus(gitStatus, 'push_remote_mismatch', 'push: remote_mismatch');
        await this.taskService.updateResult(task.id, { gitStatus: next });
        throw new ConflictException({ error: 'Push remote does not match the fork target', code: 'GIT_PUSH_REMOTE_MISMATCH' });
      }
    }

    // Guard against detached HEAD pushes so commit attribution stays correct. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const branchRes = await runGit('git rev-parse --abbrev-ref HEAD');
    const branch = branchRes.exitCode === 0 ? branchRes.stdout.trim() : '';
    if (!branch || branch === 'HEAD') {
      const next = this.buildPushFailureStatus(gitStatus, 'detached_head', 'push: detached_head');
      await this.taskService.updateResult(task.id, { gitStatus: next });
      throw new ConflictException({ error: 'Cannot push detached HEAD', code: 'GIT_PUSH_DETACHED_HEAD' });
    }

    const pushRes = await runGit(`git push origin ${shDoubleQuote(branch)}`);
    if (pushRes.exitCode !== 0) {
      const next = this.buildPushFailureStatus(gitStatus, 'push_failed', 'push: command_failed');
      await this.taskService.updateResult(task.id, { gitStatus: next });
      throw new ConflictException({ error: 'Push failed', code: 'GIT_PUSH_FAILED' });
    }

    const capture = await collectGitStatusSnapshot({ repoDir, includeWorkingTree: true });
    const next = this.buildPushSuccessStatus(gitStatus, capture);
    await this.taskService.updateResult(task.id, { gitStatus: next });

    const updated = await this.taskService.getTask(task.id, { includeMeta: true });
    if (!updated) {
      throw new NotFoundException({ error: 'Task not found' });
    }

    return updated;
  }

  private buildPushFailureStatus(existing: TaskGitStatus, reason: string, error: string): TaskGitStatus {
    // Record a push failure so the UI can surface an error state. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    return {
      ...existing,
      capturedAt: new Date().toISOString(),
      push: {
        status: 'error',
        reason,
        targetBranch: existing.final?.branch,
        targetWebUrl: existing.final?.pushWebUrl,
        targetHeadSha: existing.push?.targetHeadSha
      },
      errors: [...(existing.errors ?? []), error]
    };
  }

  private buildPushSuccessStatus(
    existing: TaskGitStatus,
    capture: { snapshot?: TaskGitStatus['final']; workingTree?: TaskGitStatus['workingTree']; pushTargetSha?: string; errors: string[] }
  ): TaskGitStatus {
    // Refresh git status after a successful push to update tags and divergence. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const finalSnapshot = capture.snapshot ?? existing.final;
    const delta = existing.delta ?? computeGitStatusDelta(existing.baseline, finalSnapshot);
    const pushError = capture.errors.find((err) => err.startsWith('pushTarget:') || err.startsWith('pushRemote:'));
    const pushState = computeGitPushState({
      delta: delta ?? null,
      final: finalSnapshot,
      pushTargetSha: capture.pushTargetSha,
      error: pushError
    });

    return {
      ...existing,
      capturedAt: new Date().toISOString(),
      final: finalSnapshot,
      workingTree: capture.workingTree ?? existing.workingTree,
      delta: delta ?? undefined,
      push: {
        ...pushState,
        targetBranch: finalSnapshot?.branch || existing.push?.targetBranch,
        targetWebUrl: finalSnapshot?.pushWebUrl || existing.push?.targetWebUrl,
        targetHeadSha: capture.pushTargetSha
      },
      errors: capture.errors.length ? [...(existing.errors ?? []), ...capture.errors] : existing.errors
    };
  }
}
