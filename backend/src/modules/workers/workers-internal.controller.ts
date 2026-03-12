import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { RepositoryService } from '../repositories/repository.service';
import { RepoRobotService } from '../repositories/repo-robot.service';
import { SkillsService } from '../skills/skills.service';
import { TaskRunner } from '../tasks/task-runner.service';
import { TaskLogStream } from '../tasks/task-log-stream.service';
import { TaskLogsService } from '../tasks/task-logs.service';
import { TaskService } from '../tasks/task.service';
import { UserApiTokenService } from '../users/user-api-token.service';
import { UserService } from '../users/user.service';
import { Public } from '../auth/auth.decorator';
import { WorkersService } from './workers.service';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

@ApiExcludeController()
@Public() // Keep worker-runtime internal APIs outside bearer auth because they authenticate with worker headers instead. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
@Controller('workers/internal')
export class WorkersInternalController {
  constructor(
    private readonly workersService: WorkersService,
    private readonly taskService: TaskService,
    private readonly taskRunner: TaskRunner,
    private readonly taskLogStream: TaskLogStream,
    private readonly taskLogsService: TaskLogsService,
    private readonly repositoryService: RepositoryService,
    private readonly repoRobotService: RepoRobotService,
    private readonly userService: UserService,
    private readonly userApiTokenService: UserApiTokenService,
    private readonly skillsService: SkillsService
  ) {}

  private async authenticate(headers: Record<string, string | string[] | undefined>) {
    const workerId = trimString(headers['x-hookcode-worker-id']);
    const token = trimString(headers['x-hookcode-worker-token']);
    const worker = await this.workersService.verifyWorkerToken(workerId, token);
    if (!worker) throw new UnauthorizedException({ error: 'Invalid worker credentials' });
    return worker;
  }

  private async requireAssignedTask(taskId: string, workerId: string) {
    const task = await this.taskService.getTask(taskId);
    if (!task || task.workerId !== workerId) {
      throw new NotFoundException({ error: 'Task not found for worker' });
    }
    return task;
  }

  @Get('repos/:repoId')
  async getRepo(@Headers() headers: Record<string, string | string[] | undefined>, @Param('repoId') repoId: string) {
    await this.authenticate(headers);
    return { repo: await this.repositoryService.getById(repoId) };
  }

  @Get('repos/:repoId/credentials')
  async getRepoScopedCredentials(@Headers() headers: Record<string, string | string[] | undefined>, @Param('repoId') repoId: string) {
    await this.authenticate(headers);
    // Return raw repo-scoped credentials only to authenticated workers so remote execution can clone repos and call providers. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return { repoScopedCredentials: await this.repositoryService.getRepoScopedCredentials(repoId) };
  }

  @Get('repos/:repoId/robots')
  async getRepoRobots(@Headers() headers: Record<string, string | string[] | undefined>, @Param('repoId') repoId: string) {
    await this.authenticate(headers);
    return { robots: await this.repoRobotService.listByRepoWithToken(repoId) };
  }

  @Get('users/default-credentials')
  async getDefaultUserCredentials(@Headers() headers: Record<string, string | string[] | undefined>) {
    await this.authenticate(headers);
    return { defaultUserCredentials: await this.userService.getDefaultUserCredentialsRaw() };
  }

  @Get('tasks/:taskId/context')
  async getTaskContext(@Headers() headers: Record<string, string | string[] | undefined>, @Param('taskId') taskId: string) {
    const worker = await this.authenticate(headers);
    const task = await this.requireAssignedTask(taskId, worker.id);
    const repo = task.repoId ? await this.repositoryService.getById(task.repoId) : null;
    const repoScopedCredentials = task.repoId ? await this.repositoryService.getRepoScopedCredentials(task.repoId) : null;
    const robotsInRepo = task.repoId ? await this.repoRobotService.listByRepoWithToken(task.repoId) : [];
    const defaultUserCredentials = await this.userService.getDefaultUserCredentialsRaw();
    // Return the complete execution context needed by the external worker runtime without granting DB access. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return {
      task,
      repo,
      // Return raw repo/user credentials only to authenticated workers so remote execution can clone repos and call providers. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      repoScopedCredentials: repoScopedCredentials ?? null,
      robotsInRepo,
      defaultUserCredentials
    };
  }

  @Get('tasks/:taskId/control-state')
  async getTaskControlState(@Headers() headers: Record<string, string | string[] | undefined>, @Param('taskId') taskId: string) {
    const worker = await this.authenticate(headers);
    await this.requireAssignedTask(taskId, worker.id);
    const state = await this.taskService.getTaskControlState(taskId);
    if (!state) throw new NotFoundException({ error: 'Task not found' });
    return state;
  }

  @Post('tasks/:taskId/execute-inline')
  async executeInlineTask(@Headers() headers: Record<string, string | string[] | undefined>, @Param('taskId') taskId: string) {
    const worker = await this.authenticate(headers);
    const task = await this.requireAssignedTask(taskId, worker.id);
    if (worker.kind !== 'local') {
      // Keep backend-inline execution limited to local workers so remote hosts cannot tunnel commands back into backend over the internal worker channel. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
      throw new ForbiddenException({ error: 'Inline execution is only available to local workers' });
    }
    await this.taskRunner.executeAssignedTaskInline(task);
    return { success: true };
  }

  @Post('tasks/:taskId/logs')
  async appendLogs(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('taskId') taskId: string,
    @Body() body: { startSeq?: number; lines?: string[] }
  ) {
    const worker = await this.authenticate(headers);
    await this.requireAssignedTask(taskId, worker.id);
    const startSeq = Number(body?.startSeq ?? 0);
    const lines = Array.isArray(body?.lines) ? body.lines.map((line) => String(line)) : [];
    if (!Number.isFinite(startSeq) || startSeq < 0 || !lines.length) {
      throw new BadRequestException({ error: 'startSeq and lines are required' });
    }
    for (let index = 0; index < lines.length; index += 1) {
      const seq = startSeq + index + 1;
      const line = lines[index] ?? '';
      this.taskLogStream.publish(taskId, line, seq);
      await this.taskLogsService.appendLog(taskId, seq, line);
    }
    return { success: true };
  }

  @Post('tasks/:taskId/result-patch')
  async patchResult(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('taskId') taskId: string,
    @Body() body: { patch?: Record<string, unknown>; status?: 'queued' | 'processing' | 'succeeded' | 'failed' | 'commented' }
  ) {
    const worker = await this.authenticate(headers);
    await this.requireAssignedTask(taskId, worker.id);
    await this.taskService.patchResult(taskId, (body?.patch ?? {}) as any, body?.status);
    return { success: true };
  }

  @Post('tasks/:taskId/dependency-result')
  async patchDependencyResult(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('taskId') taskId: string,
    @Body() body: { dependencyResult?: unknown }
  ) {
    const worker = await this.authenticate(headers);
    await this.requireAssignedTask(taskId, worker.id);
    await this.taskService.updateDependencyResult(taskId, (body?.dependencyResult ?? null) as any);
    return { success: true };
  }

  @Post('tasks/:taskId/finalize')
  async finalizeTask(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('taskId') taskId: string,
    @Body() body: { status?: 'succeeded' | 'failed'; message?: string; providerCommentUrl?: string; outputText?: string; gitStatus?: unknown; durationMs?: number; stopReason?: 'manual_stop' | 'deleted' }
  ) {
    const worker = await this.authenticate(headers);
    const task = await this.requireAssignedTask(taskId, worker.id);
    if (body?.status === 'succeeded') {
      await this.taskRunner.reportWorkerSuccess(task, {
        providerCommentUrl: trimString(body.providerCommentUrl),
        outputText: trimString(body.outputText),
        gitStatus: body.gitStatus as any,
        durationMs: Number(body.durationMs ?? 0) || 0
      });
      return { success: true };
    }
    await this.taskRunner.reportWorkerFailure(task, {
      message: trimString(body?.message) || 'Worker execution failed',
      providerCommentUrl: trimString(body?.providerCommentUrl),
      gitStatus: body?.gitStatus as any,
      durationMs: Number(body?.durationMs ?? 0) || 0,
      stopReason: body?.stopReason
    });
    return { success: true };
  }

  @Post('tasks/:taskId/ensure-group-id')
  async ensureGroupId(@Headers() headers: Record<string, string | string[] | undefined>, @Param('taskId') taskId: string) {
    const worker = await this.authenticate(headers);
    const task = await this.requireAssignedTask(taskId, worker.id);
    return { groupId: await this.taskService.ensureTaskGroupId(task) };
  }

  @Get('task-groups/:groupId/thread-id')
  async getThreadId(@Headers() headers: Record<string, string | string[] | undefined>, @Param('groupId') groupId: string) {
    await this.authenticate(headers);
    return { threadId: await this.taskService.getTaskGroupThreadId(groupId) };
  }

  @Post('task-groups/:groupId/thread-id')
  async setThreadId(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('groupId') groupId: string,
    @Body() body: { threadId?: string }
  ) {
    await this.authenticate(headers);
    return { success: await this.taskService.bindTaskGroupThreadId(groupId, trimString(body?.threadId) || '') };
  }

  @Get('task-groups/:groupId/history/:taskId')
  async getTaskGroupHistory(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string
  ) {
    await this.authenticate(headers);
    return {
      hasPriorTaskGroupTask: await this.taskService.hasPriorTaskGroupTask(groupId, taskId),
      hasTaskGroupLogs: await this.taskService.hasTaskGroupLogs(groupId)
    };
  }

  @Get('task-groups/:groupId/skills')
  async getTaskGroupSkills(@Headers() headers: Record<string, string | string[] | undefined>, @Param('groupId') groupId: string) {
    await this.authenticate(headers);
    return { selection: await this.skillsService.resolveTaskGroupSkillSelection(groupId) };
  }

  @Post('skills/prompt-prefix')
  async getPromptPrefix(@Headers() headers: Record<string, string | string[] | undefined>, @Body() body: { selection?: string[] | null }) {
    await this.authenticate(headers);
    return { promptPrefix: await this.skillsService.buildPromptPrefix(Array.isArray(body?.selection) ? body.selection : body?.selection === null ? null : null) };
  }

  @Post('pat/verify')
  async verifyPat(@Headers() headers: Record<string, string | string[] | undefined>, @Body() body: { token?: string }) {
    await this.authenticate(headers);
    return { result: await this.userApiTokenService.verifyToken(trimString(body?.token) || '') };
  }

  @Post('bootstrap-user')
  async ensureBootstrapUser(@Headers() headers: Record<string, string | string[] | undefined>) {
    await this.authenticate(headers);
    // Let external workers request bootstrap-user creation only through the authenticated internal channel. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    await this.userService.ensureBootstrapUser();
    return { success: true };
  }

  @Post('pat/create')
  async createPat(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { userId?: string; input?: { name?: string; scopes?: unknown; expiresAt?: string | null } }
  ) {
    await this.authenticate(headers);
    let userId = trimString(body?.userId);
    if (!userId) {
      // Resolve a default PAT owner inside backend so external workers do not need direct user bootstrap logic. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      const current = await this.userService.getDefaultUserCredentialsRaw();
      if (current?.userId) {
        userId = trimString(current.userId);
      } else {
        await this.userService.ensureBootstrapUser();
        userId = trimString((await this.userService.getDefaultUserCredentialsRaw())?.userId);
      }
    }
    if (!userId) throw new BadRequestException({ error: 'userId is required' });
    return await this.userApiTokenService.createToken(userId, body?.input as any);
  }
}
