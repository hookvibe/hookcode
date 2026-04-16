import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, Post, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { GlobalCredentialService } from '../repositories/global-credentials.service';
import { RepositoryService } from '../repositories/repository.service';
import { RobotCatalogService } from '../repositories/robot-catalog.service';
import { SkillsService } from '../skills/skills.service';
import { TaskRunner } from '../tasks/task-runner.service';
import { TaskLogStream } from '../tasks/task-log-stream.service';
import { TaskLogsService } from '../tasks/task-logs.service';
import { TaskService } from '../tasks/task.service';
import { UserApiTokenService } from '../users/user-api-token.service';
import { UserService } from '../users/user.service';
import { Public } from '../auth/auth.decorator';
import { WorkersService } from './workers.service';
import type { WorkerRecord } from '../../types/worker';
import type { WorkerPollRequest, WorkerHeartbeatRequest, WorkerTaskFinalizeRequest } from '../../types/workerProtocol';
import { parsePositiveInt } from '../../utils/parse';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const LONG_POLL_TIMEOUT_MS = parsePositiveInt(process.env.WORKER_POLL_TIMEOUT_MS, 30_000);

@ApiExcludeController()
@Public()
@Controller('workers/internal')
export class WorkersInternalController {
  constructor(
    private readonly workersService: WorkersService,
    private readonly taskService: TaskService,
    private readonly taskRunner: TaskRunner,
    private readonly taskLogStream: TaskLogStream,
    private readonly taskLogsService: TaskLogsService,
    private readonly repositoryService: RepositoryService,
    private readonly robotCatalogService: RobotCatalogService,
    private readonly globalCredentialService: GlobalCredentialService,
    private readonly userService: UserService,
    private readonly userApiTokenService: UserApiTokenService,
    private readonly skillsService: SkillsService
  ) {}

  private async authenticate(headers: Record<string, string | string[] | undefined>): Promise<WorkerRecord> {
    const authHeader = trimString(headers['authorization']);
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!apiKey) throw new UnauthorizedException({ error: 'Missing API key' });
    const worker = await this.workersService.authenticateByApiKey(apiKey);
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

  // ── Poll & Heartbeat ──

  @Post('poll')
  async poll(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: WorkerPollRequest,
    @Res() res: Response
  ) {
    const worker = await this.authenticate(headers);
    await this.workersService.markWorkerOnlineFromPoll(worker.id, body ?? {});

    // Try immediate claim
    const hasCapacity = await this.workersService.hasCapacity(worker.id);
    if (hasCapacity) {
      const claimed = await this.workersService.claimNextTask(worker.id);
      if (claimed) {
        res.json({ task: { id: claimed.taskId } });
        return;
      }
    }

    // Long-poll: wait up to LONG_POLL_TIMEOUT_MS for a task
    const deadline = Date.now() + LONG_POLL_TIMEOUT_MS;
    const pollInterval = 2_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const cap = await this.workersService.hasCapacity(worker.id);
      if (!cap) break;
      const claimed = await this.workersService.claimNextTask(worker.id);
      if (claimed) {
        res.json({ task: { id: claimed.taskId } });
        return;
      }
    }

    res.json({ task: null });
  }

  @Post('heartbeat')
  async heartbeat(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: WorkerHeartbeatRequest
  ) {
    const worker = await this.authenticate(headers);
    await this.workersService.recordHeartbeat(worker.id, body ?? {});
    return { ok: true, workerId: worker.id, workerName: worker.name };
  }

  // ── Task Context & Data ──

  @Get('repos/:repoId')
  async getRepo(@Headers() headers: Record<string, string | string[] | undefined>, @Param('repoId') repoId: string) {
    await this.authenticate(headers);
    return { repo: await this.repositoryService.getById(repoId) };
  }

  @Get('repos/:repoId/credentials')
  async getRepoScopedCredentials(@Headers() headers: Record<string, string | string[] | undefined>, @Param('repoId') repoId: string) {
    await this.authenticate(headers);
    return { repoScopedCredentials: await this.repositoryService.getRepoScopedCredentials(repoId) };
  }

  @Get('repos/:repoId/robots')
  async getRepoRobots(@Headers() headers: Record<string, string | string[] | undefined>, @Param('repoId') repoId: string) {
    await this.authenticate(headers);
    return { robots: await this.robotCatalogService.listAvailableByRepoWithToken(repoId) };
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
    const robotsInRepo = task.repoId ? await this.robotCatalogService.listAvailableByRepoWithToken(task.repoId) : [];
    const globalCredentials = await this.globalCredentialService.getCredentialsRaw();
    const defaultUserCredentials = await this.userService.getDefaultUserCredentialsRaw();
    return {
      task,
      repo,
      repoScopedCredentials: repoScopedCredentials ?? null,
      globalCredentials,
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

  // ── Task Logs & Progress ──

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

  // ── Task Finalize ──

  @Post('tasks/:taskId/finalize')
  async finalizeTask(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('taskId') taskId: string,
    @Body() body: WorkerTaskFinalizeRequest
  ) {
    const worker = await this.authenticate(headers);
    const task = await this.requireAssignedTask(taskId, worker.id);
    try {
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
        stopReason: body?.stopReason as any
      });
    } finally {
      await this.workersService.releaseWorkerSlot(worker.id);
    }
    return { success: true };
  }

  // ── Task Group ──

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
    return { promptPrefix: await this.skillsService.buildPromptPrefix(Array.isArray(body?.selection) ? body.selection : null) };
  }

  // ── Auth Utility ──

  @Post('pat/verify')
  async verifyPat(@Headers() headers: Record<string, string | string[] | undefined>, @Body() body: { token?: string }) {
    await this.authenticate(headers);
    return { result: await this.userApiTokenService.verifyToken(trimString(body?.token) || '') };
  }

  @Post('bootstrap-user')
  async ensureBootstrapUser(@Headers() headers: Record<string, string | string[] | undefined>) {
    await this.authenticate(headers);
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
