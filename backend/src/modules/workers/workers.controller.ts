import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { WorkersService } from './workers.service';
import { resolveWorkerPublicApiBaseUrl } from './worker-public-url';
import {
  CreateWorkerRequestDto,
  ListWorkersResponseDto,
  UpdateWorkerRequestDto,
  WorkerResponseDto,
} from './dto/workers-swagger.dto';

@AuthScopeGroup('system')
@Controller('workers')
@ApiTags('Workers')
@ApiBearerAuth('bearerAuth')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  private requireAdmin(req: Request): { id: string; roles?: string[] } {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (!req.user.roles?.includes('admin')) throw new UnauthorizedException({ error: 'Admin required' });
    return req.user;
  }

  @Get()
  @ApiOperation({ summary: 'List workers', operationId: 'workers_list' })
  @ApiOkResponse({ description: 'OK', type: ListWorkersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async list(@Req() req: Request) {
    this.requireAdmin(req);
    const workers = await this.workersService.listWorkers();
    const urls = resolveWorkerPublicApiBaseUrl(req);
    return { workers, defaultBackendUrl: urls.backendUrl };
  }

  @Post()
  @ApiOperation({ summary: 'Create remote worker', description: 'Create a remote worker and return its API key.', operationId: 'workers_create' })
  @ApiOkResponse({ description: 'OK' })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async create(@Req() req: Request, @Body() body: CreateWorkerRequestDto) {
    const user = this.requireAdmin(req);
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException({ error: 'name is required' });
    const created = await this.workersService.createRemoteWorker({
      actorUserId: user.id,
      name,
      maxConcurrency: body?.maxConcurrency,
      providers: body?.providers,
    });
    return created;
  }

  @Post(':id/rotate-api-key')
  @ApiOperation({ summary: 'Rotate worker API key', description: 'Generate a new API key and invalidate the old one.', operationId: 'workers_rotate_api_key' })
  @ApiOkResponse({ description: 'OK' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async rotateApiKey(@Req() req: Request) {
    this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const rotated = await this.workersService.rotateApiKey(id);
    if (!rotated) throw new NotFoundException({ error: 'Worker not found' });
    return rotated;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update worker', description: 'Update worker metadata such as name, status, or concurrency.', operationId: 'workers_update' })
  @ApiOkResponse({ description: 'OK', type: WorkerResponseDto })
  async update(@Req() req: Request, @Body() body: UpdateWorkerRequestDto) {
    this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const updated = await this.workersService.updateWorker(id, body ?? {});
    if (!updated) throw new NotFoundException({ error: 'Worker not found' });
    return { worker: updated };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete worker', operationId: 'workers_delete' })
  @ApiOkResponse({ description: 'OK' })
  async remove(@Req() req: Request) {
    this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const ok = await this.workersService.deleteWorker(id);
    if (!ok) throw new NotFoundException({ error: 'Worker not found or cannot be deleted' });
    return { success: true };
  }
}
