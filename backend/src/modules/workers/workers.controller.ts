import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthScopeGroup, Public } from '../auth/auth.decorator';
import { WorkersService } from './workers.service';
import { WorkersConnectionService } from './workers-connection.service';
import { resolveWorkerPublicApiBaseUrl } from './worker-public-url';
import {
  CreateWorkerRequestDto,
  ListWorkersResponseDto,
  PrepareRuntimeRequestDto,
  RegisterWorkerRequestDto,
  RegisterWorkerResponseDto,
  ResetWorkerBindCodeRequestDto,
  UpdateWorkerRequestDto,
  WorkerResponseDto,
  WorkerBindResponseDto
} from './dto/workers-swagger.dto';

@AuthScopeGroup('system') // Scope admin worker management APIs under system-level PAT permissions until a dedicated worker scope is introduced. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
@Controller('workers')
@ApiTags('Workers')
@ApiBearerAuth('bearerAuth')
export class WorkersController {
  constructor(
    private readonly workersService: WorkersService,
    private readonly workersConnections: WorkersConnectionService
  ) {}

  private requireAdmin(req: Request): { id: string; roles?: string[] } {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (!req.user.roles?.includes('admin')) throw new UnauthorizedException({ error: 'Admin required' });
    return req.user;
  }

  @Get()
  @ApiOperation({ summary: 'List workers', description: 'List all local/remote workers visible to admins.', operationId: 'workers_list' })
  @ApiOkResponse({ description: 'OK', type: ListWorkersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(@Req() req: Request) {
    this.requireAdmin(req);
    const workers = await this.workersService.listWorkers();
    const urls = resolveWorkerPublicApiBaseUrl(req);
    return { workers, versionRequirement: this.workersService.getWorkerVersionRequirement(), defaultBackendUrl: urls.backendUrl };
  }

  @Post()
  @ApiOperation({ summary: 'Create remote worker', description: 'Create a remote worker bind code for admin provisioning.', operationId: 'workers_create' })
  @ApiOkResponse({ description: 'OK', type: WorkerBindResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async create(@Req() req: Request, @Body() body: CreateWorkerRequestDto) {
    const user = this.requireAdmin(req);
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException({ error: 'name is required' });
    const urls = resolveWorkerPublicApiBaseUrl(req);
    const created = await this.workersService.createRemoteWorker({
      actorUserId: user.id,
      name,
      maxConcurrency: body?.maxConcurrency,
      backendUrl: String(body?.backendUrl ?? '').trim() || urls.backendUrl
    });
    return created;
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register worker from bind code', description: 'Exchange a one-time bind code for runtime worker credentials.', operationId: 'workers_register' })
  @ApiOkResponse({ description: 'OK', type: RegisterWorkerResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  async register(@Req() req: Request, @Body() body: RegisterWorkerRequestDto) {
    try {
      const registered = await this.workersService.registerWorker(String(body?.bindCode ?? ''));
      this.workersConnections.disconnect(registered.workerId, 'worker_rebound');
      return { workerId: registered.workerId, workerToken: registered.workerToken, backendUrl: registered.backendUrl };
    } catch (error) {
      throw new BadRequestException({ error: error instanceof Error ? error.message : 'Unable to register worker' });
    }
  }

  @Post(':id/reset-bind-code')
  @ApiOperation({ summary: 'Reset worker bind code', description: 'Generate a fresh one-time bind code for a worker.', operationId: 'workers_reset_bind_code' })
  @ApiOkResponse({ description: 'OK', type: WorkerBindResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async resetBindCode(@Req() req: Request, @Body() body: ResetWorkerBindCodeRequestDto) {
    this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const urls = resolveWorkerPublicApiBaseUrl(req);
    const rotated = await this.workersService.resetWorkerBindCode(id, String(body?.backendUrl ?? '').trim() || urls.backendUrl);
    if (!rotated) throw new NotFoundException({ error: 'Worker not found' });
    this.workersConnections.disconnect(id, 'bind_code_reset');
    return rotated;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update worker', description: 'Update worker admin metadata such as name, status, or concurrency.', operationId: 'workers_update' })
  @ApiOkResponse({ description: 'OK', type: WorkerResponseDto })
  async update(@Req() req: Request, @Body() body: UpdateWorkerRequestDto) {
    this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const updated = await this.workersService.updateWorker(id, body ?? {});
    if (!updated) throw new NotFoundException({ error: 'Worker not found' });
    return { worker: updated };
  }

  @Post(':id/prepare-runtime')
  @ApiOperation({ summary: 'Prepare worker runtime', description: 'Ask a connected worker to install provider CLI dependencies.', operationId: 'workers_prepare_runtime' })
  @ApiOkResponse({ description: 'OK' })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  async prepareRuntime(@Req() req: Request, @Body() body: PrepareRuntimeRequestDto) {
    this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const ok = this.workersConnections.sendPrepareRuntime(id, Array.isArray(body?.providers) ? body.providers : undefined);
    if (!ok) throw new ConflictException({ error: 'Worker is not connected' });
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete worker', description: 'Delete a remote worker from the registry.', operationId: 'workers_delete' })
  @ApiOkResponse({ description: 'OK' })
  async remove(@Req() req: Request) {
    this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const ok = await this.workersService.deleteWorker(id);
    if (!ok) throw new NotFoundException({ error: 'Worker not found or cannot be deleted' });
    return { success: true };
  }
}
