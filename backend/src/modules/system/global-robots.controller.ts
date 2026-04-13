import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { LogWriterService } from '../logs/log-writer.service';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { GlobalCredentialService } from '../repositories/global-credentials.service';
import { GlobalRobotService, GlobalRobotValidationError } from '../repositories/global-robot.service';
import { CreateGlobalRobotDto, UpdateGlobalRobotDto } from './dto/global-robots.dto';
import { UpdateModelCredentialsDto } from '../users/dto/update-model-credentials.dto';

@AuthScopeGroup('system') // Scope admin global robot/credential management under system-level PAT permissions. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
@Controller('system')
@ApiTags('System')
@ApiBearerAuth('bearerAuth')
export class GlobalRobotsController {
  constructor(
    private readonly globalRobotService: GlobalRobotService,
    private readonly globalCredentialService: GlobalCredentialService,
    private readonly logWriter: LogWriterService
  ) {}

  private logSanitizedFailure(context: string, err: unknown) {
    // Keep admin failure logs useful without dumping raw error payloads that may contain credential material. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : typeof (err as { message?: unknown } | null)?.message === 'string'
          ? String((err as { message?: unknown }).message)
          : String(err ?? 'Unknown error');
    const sanitized = message.replace(/(api[_-]?key|token|authorization|password|secret)(\s*[:=]\s*|\s+)(\S+)/gi, '$1$2[REDACTED]');
    console.error(`[system] ${context}: ${sanitized}`);
  }

  private buildGlobalRobotBadRequest(err: GlobalRobotValidationError): BadRequestException {
    // Translate service-level global-robot validation codes into stable API errors so controller behavior does not depend on message text matching. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    return new BadRequestException({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {})
    });
  }

  private requireAdmin(req: Request) {
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
    if (!req.user.roles?.includes('admin')) throw new ForbiddenException({ error: 'Forbidden', code: 'ADMIN_REQUIRED' });
    return req.user;
  }

  @Get('global-credentials')
  @ApiOperation({ summary: 'Get global provider credentials', description: 'Return admin-managed global provider credential profiles.', operationId: 'system_global_credentials_get' })
  @ApiOkResponse({ description: 'OK', schema: { type: 'object', properties: { credentials: { type: 'object' } } } })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async getGlobalCredentials(@Req() req: Request) {
    this.requireAdmin(req);
    return { credentials: await this.globalCredentialService.getCredentialsPublic() };
  }

  @Put('global-credentials')
  @ApiOperation({ summary: 'Replace global provider credentials', description: 'Replace the full admin-managed global provider credential profile store.', operationId: 'system_global_credentials_put' })
  @ApiBody({ schema: { type: 'object', properties: { credentials: { type: 'object' } } } })
  @ApiOkResponse({ description: 'OK', schema: { type: 'object', properties: { credentials: { type: 'object' } } } })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async replaceGlobalCredentials(@Req() req: Request, @Body() body: { credentials?: unknown }) {
    try {
      const user = this.requireAdmin(req);
      const credentials = await this.globalCredentialService.replaceCredentials(body?.credentials ?? {});
      // Emit an audit log whenever admin-managed global credentials are replaced. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Global provider credentials replaced',
        code: 'GLOBAL_CREDENTIALS_REPLACED',
        actorUserId: user.id
      });
      return { credentials };
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException || err instanceof BadRequestException) throw err;
      this.logSanitizedFailure('replace global credentials failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update global credentials' });
    }
  }

  @Patch('global-credentials')
  @ApiOperation({
    summary: 'Patch global provider credentials',
    description: 'Incrementally update admin-managed global provider credential profiles without clearing unchanged secrets.',
    operationId: 'system_global_credentials_patch'
  })
  @ApiBody({ type: UpdateModelCredentialsDto })
  @ApiOkResponse({ description: 'OK', schema: { type: 'object', properties: { credentials: { type: 'object' } } } })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async patchGlobalCredentials(@Req() req: Request, @Body() body: UpdateModelCredentialsDto) {
    try {
      const user = this.requireAdmin(req);
      const credentials = await this.globalCredentialService.updateCredentials((body ?? {}) as any);
      // Keep global credential edits auditable even when admins only patch a single profile. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Global provider credentials patched',
        code: 'GLOBAL_CREDENTIALS_PATCHED',
        actorUserId: user.id
      });
      return { credentials };
    } catch (err: any) {
      const message = err?.message ? String(err.message) : '';
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
      if (message.includes('remark is required')) {
        throw new BadRequestException({ error: message });
      }
      this.logSanitizedFailure('patch global credentials failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update global credentials' });
    }
  }

  @Get('global-robots')
  @ApiOperation({ summary: 'List global robots', description: 'List admin-managed globally shared robots.', operationId: 'system_global_robots_list' })
  @ApiOkResponse({ description: 'OK', schema: { type: 'object', properties: { robots: { type: 'array', items: { type: 'object' } } } } })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async listGlobalRobots(@Req() req: Request) {
    this.requireAdmin(req);
    return { robots: await this.globalRobotService.listAll() };
  }

  @Post('global-robots')
  @ApiOperation({ summary: 'Create global robot', description: 'Create an admin-managed globally shared robot.', operationId: 'system_global_robots_create' })
  @ApiBody({ type: CreateGlobalRobotDto })
  @ApiOkResponse({ description: 'OK', schema: { type: 'object', properties: { robot: { type: 'object' } } } })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async createGlobalRobot(@Req() req: Request, @Body() body: CreateGlobalRobotDto) {
    try {
      const user = this.requireAdmin(req);
      const robot = await this.globalRobotService.createRobot(user, body);
      if (robot.isDefault) await this.globalRobotService.setDefaultRobot(robot.id);
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Global robot created',
        code: 'GLOBAL_ROBOT_CREATED',
        actorUserId: user.id,
        meta: { robotId: robot.id, name: robot.name, enabled: robot.enabled, modelProvider: robot.modelProvider ?? null }
      });
      return { robot };
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
      if (err instanceof GlobalRobotValidationError) {
        throw this.buildGlobalRobotBadRequest(err);
      }
      this.logSanitizedFailure('create global robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to create global robot' });
    }
  }

  @Patch('global-robots/:id')
  @ApiOperation({ summary: 'Update global robot', description: 'Update an admin-managed globally shared robot.', operationId: 'system_global_robots_update' })
  @ApiBody({ type: UpdateGlobalRobotDto })
  @ApiOkResponse({ description: 'OK', schema: { type: 'object', properties: { robot: { type: 'object' } } } })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async updateGlobalRobot(@Req() req: Request, @Body() body: UpdateGlobalRobotDto) {
    try {
      const user = this.requireAdmin(req);
      const id = String(req.params.id ?? '').trim();
      const robot = await this.globalRobotService.updateRobot(id, body);
      if (!robot) throw new NotFoundException({ error: 'Robot not found' });
      if (robot.isDefault) await this.globalRobotService.setDefaultRobot(robot.id);
      void this.logWriter.logOperation({
        level: 'info',
        message: 'Global robot updated',
        code: 'GLOBAL_ROBOT_UPDATED',
        actorUserId: user.id,
        meta: { robotId: robot.id, name: robot.name, enabled: robot.enabled, modelProvider: robot.modelProvider ?? null }
      });
      return { robot };
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException || err instanceof NotFoundException) throw err;
      if (err instanceof GlobalRobotValidationError) {
        throw this.buildGlobalRobotBadRequest(err);
      }
      this.logSanitizedFailure('update global robot failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update global robot' });
    }
  }

  @Delete('global-robots/:id')
  @ApiOperation({ summary: 'Delete global robot', description: 'Delete an admin-managed globally shared robot.', operationId: 'system_global_robots_delete' })
  @ApiOkResponse({ description: 'OK', schema: { type: 'object', properties: { success: { type: 'boolean' } } } })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async deleteGlobalRobot(@Req() req: Request) {
    const user = this.requireAdmin(req);
    const id = String(req.params.id ?? '').trim();
    const deleted = await this.globalRobotService.deleteRobot(id);
    if (!deleted) throw new NotFoundException({ error: 'Robot not found' });
    void this.logWriter.logOperation({
      level: 'info',
      message: 'Global robot deleted',
      code: 'GLOBAL_ROBOT_DELETED',
      actorUserId: user.id,
      meta: { robotId: id }
    });
    return { success: true };
  }
}
