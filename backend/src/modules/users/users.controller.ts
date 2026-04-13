import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { isAccountEditDisabled } from '../../config/features';
import { UserService } from './user.service';
import { UserCredentialValidationError } from './user.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateModelCredentialsDto } from './dto/update-model-credentials.dto';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SuccessResponseDto } from '../common/dto/basic-response.dto';
import { PatchMeResponseDto } from './dto/patch-me-response.dto';
import { ModelCredentialsResponseDto } from './dto/model-credentials.dto';
import { ProviderRuntimeStatusesResponseDto } from './dto/provider-runtime.dto';
import { ModelProviderModelsRequestDto, ModelProviderModelsResponseDto } from '../common/dto/model-provider-models.dto';
import { listModelProviderModels, ModelProviderModelsFetchError, normalizeSupportedModelProviderKey } from '../../services/modelProviderModels';
import { listLocalProviderAuthStatuses, resolveProviderExecutionCredential } from '../../modelProviders/providerCredentialResolver';
import { CreateUserApiTokenDto, CreateUserApiTokenResponseDto, ListUserApiTokensResponseDto, UpdateUserApiTokenDto, UserApiTokenResponseDto } from './dto/api-tokens.dto';
import { UserApiTokenService } from './user-api-token.service';
import { LogWriterService } from '../logs/log-writer.service'; // Emit user account operation logs for admins. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
@AuthScopeGroup('account') // Scope user APIs under the account group for PAT access. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly apiTokenService: UserApiTokenService,
    // Log user/account changes with system log writer. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    private readonly logWriter: LogWriterService
  ) {}

  private buildCredentialValidationBadRequest(err: InstanceType<typeof UserCredentialValidationError>): BadRequestException {
    // Convert user credential service validation errors into stable 400 payloads so account credential editing no longer depends on message matching. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    return new BadRequestException({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {})
    });
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update my profile',
    description: 'Update fields on the current user.',
    operationId: 'users_patch_me'
  })
  @ApiOkResponse({ description: 'OK', type: PatchMeResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async patchMe(@Req() req: Request, @Body() body: UpdateUserDto) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      if (isAccountEditDisabled()) {
        // Security boundary (2026-01-15): client-side UI disabling is not sufficient; block self-service edits on the server.
        throw new ForbiddenException({ error: 'Account editing is disabled', code: 'ACCOUNT_EDIT_DISABLED' });
      }

      const updated = await this.userService.updateUser(req.user.id, { displayName: body.displayName });
      if (!updated) throw new NotFoundException({ error: 'User not found' });
      // Log account profile updates without storing the raw display name. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'User profile updated',
        code: 'USER_PROFILE_UPDATED',
        actorUserId: req.user.id,
        meta: { displayNameUpdated: body?.displayName !== undefined }
      });
      return { user: updated };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[users] update me failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update user' });
    }
  }

  @Patch('me/password')
  @ApiOperation({
    summary: 'Change my password',
    description: 'Change password for the current user.',
    operationId: 'users_change_password'
  })
  @ApiOkResponse({ description: 'OK', type: SuccessResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async patchPassword(@Req() req: Request, @Body() body: ChangePasswordDto) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      if (isAccountEditDisabled()) {
        // Security boundary (2026-01-15): always enforce sensitive feature toggles on the backend.
        throw new ForbiddenException({ error: 'Account editing is disabled', code: 'ACCOUNT_EDIT_DISABLED' });
      }

      const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

      if (!currentPassword || !newPassword) {
        throw new BadRequestException({ error: 'Missing currentPassword or newPassword' });
      }
      if (newPassword.length < 6) {
        throw new BadRequestException({ error: 'Password too short' });
      }

      const ok = await this.userService.verifyPassword(req.user.username, currentPassword);
      if (!ok) {
        throw new UnauthorizedException({ error: 'Current password is incorrect' });
      }

      await this.userService.setPassword(req.user.id, newPassword);
      // Log password changes without storing secrets. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'warn',
        message: 'User password changed',
        code: 'USER_PASSWORD_CHANGED',
        actorUserId: req.user.id
      });
      return { success: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[users] change password failed', err);
      throw new InternalServerErrorException({ error: 'Failed to change password' });
    }
  }

  @Get('me/model-credentials')
  @ApiOperation({
    summary: 'Get my model/provider credentials (redacted)',
    description: 'Returns credentials in a safe-to-display form (tokens/api keys are not included).',
    operationId: 'users_get_model_credentials'
  })
  @ApiOkResponse({ description: 'OK', type: ModelCredentialsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async getModelCredentials(@Req() req: Request) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const credentials = await this.userService.getModelCredentials(req.user.id);
      if (!credentials) throw new NotFoundException({ error: 'User not found' });
      return { credentials };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[users] get model credentials failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch model credentials' });
    }
  }

  // Expose local provider runtime detection so the account settings page can show ClaudeCodeUI-style auth status. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
  @Get('me/model-providers/status')
  @ApiOperation({
    summary: 'Get my local model provider runtime status',
    description: 'Returns ClaudeCodeUI-style local auth detection results for Codex, Claude Code, and Gemini.',
    operationId: 'users_get_model_provider_runtime_status'
  })
  @ApiOkResponse({ description: 'OK', type: ProviderRuntimeStatusesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async getMyModelProviderRuntimeStatus(@Req() req: Request) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      return {
        precedence: ['local', 'robot', 'repo', 'user'],
        providers: await listLocalProviderAuthStatuses()
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[users] get model provider runtime status failed', err);
      throw new InternalServerErrorException({ error: 'Failed to fetch model provider runtime status' });
    }
  }

  @Patch('me/model-credentials')
  @ApiOperation({
    summary: 'Update my model/provider credentials',
    description: 'Update credential profiles and model provider settings for the current user.',
    operationId: 'users_patch_model_credentials'
  })
  @ApiOkResponse({ description: 'OK', type: ModelCredentialsResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async patchModelCredentials(@Req() req: Request, @Body() body: UpdateModelCredentialsDto) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });

      const credentials = await this.userService.updateModelCredentials(req.user.id, {
        ...(body.codex !== undefined ? { codex: body.codex as any } : {}),
        ...(body.claude_code !== undefined ? { claude_code: body.claude_code as any } : {}),
        ...(body.gemini_cli !== undefined ? { gemini_cli: body.gemini_cli as any } : {}),
        ...(body.gitlab !== undefined ? { gitlab: body.gitlab as any } : {}),
        ...(body.github !== undefined ? { github: body.github as any } : {})
      });
      if (!credentials) throw new NotFoundException({ error: 'User not found' });
      // Track which provider credential groups were touched without storing secrets. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      const providersTouched = ['codex', 'claude_code', 'gemini_cli', 'gitlab', 'github'].filter(
        (provider) => (body as any)?.[provider] !== undefined
      );
      void this.logWriter.logOperation({
        level: 'info',
        message: 'User model credentials updated',
        code: 'USER_MODEL_CREDENTIALS_UPDATED',
        actorUserId: req.user.id,
        meta: { providers: providersTouched }
      });
      return { credentials };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      if (err instanceof UserCredentialValidationError) {
        throw this.buildCredentialValidationBadRequest(err);
      }
      console.error('[users] update model credentials failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update model credentials' });
    }
  }

  @Post('me/model-credentials/models')
  @ApiOperation({
    summary: 'List models for a model provider credential (my account)',
    description: 'Lists models using either a stored credential profile or an inline apiKey (never returned).',
    operationId: 'users_list_model_provider_models'
  })
  @ApiOkResponse({ description: 'OK', type: ModelProviderModelsResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async listMyModelProviderModels(@Req() req: Request, @Body() body: ModelProviderModelsRequestDto) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });

      const provider = normalizeSupportedModelProviderKey(body?.provider);
      const profileId = typeof body?.profileId === 'string' ? body.profileId.trim() : '';
      const overrideApiBaseUrl = typeof body?.credential?.apiBaseUrl === 'string' ? body.credential.apiBaseUrl.trim() : '';
      const inlineApiKey = typeof body?.credential?.apiKey === 'string' ? body.credential.apiKey.trim() : '';

      const storedCredentials = await this.userService.getModelCredentialsRaw(req.user.id);
      if (!storedCredentials) throw new NotFoundException({ error: 'User not found' });

      const providerProfiles = profileId ? ((storedCredentials as any)?.[provider]?.profiles ?? []) : [];
      const storedProfile = profileId ? providerProfiles.find((p: any) => p && String(p.id ?? '').trim() === profileId) : null;
      if (profileId && !storedProfile) {
        throw new BadRequestException({ error: 'profileId does not exist in your account credentials', code: 'MODEL_PROFILE_NOT_FOUND' });
      }

      // Reuse the execution resolver so account model listing follows the same local-first precedence. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
      const resolvedCredential =
        !profileId && !inlineApiKey
          ? await resolveProviderExecutionCredential({
              provider,
              userCredentials: storedCredentials
            })
          : null;

      const apiKey = inlineApiKey || String(storedProfile?.apiKey ?? '').trim() || String(resolvedCredential?.apiKey ?? '').trim();
      if (!apiKey) {
        if (resolvedCredential?.resolvedLayer === 'local' && resolvedCredential.canExecute) {
          throw new BadRequestException({
            error: 'Local provider auth is available, but it does not expose an API key for model listing',
            code: 'MODEL_API_KEY_UNAVAILABLE'
          });
        }
        throw new BadRequestException({ error: 'credential.apiKey is required', code: 'MODEL_API_KEY_REQUIRED' });
      }

      const apiBaseUrl =
        overrideApiBaseUrl || String(storedProfile?.apiBaseUrl ?? '').trim() || String(resolvedCredential?.apiBaseUrl ?? '').trim() || undefined;

      const result = await listModelProviderModels({
        provider,
        apiKey,
        apiBaseUrl,
        forceRefresh: Boolean(body?.forceRefresh)
      });

      return { models: result.models, source: result.source };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      if (err instanceof ModelProviderModelsFetchError && (err.status === 401 || err.status === 403)) {
        // UX: surface invalid keys explicitly so users can fix credentials instead of seeing fallbacks. b8fucnmey62u0muyn7i0
        throw new BadRequestException({ error: 'Model provider API key is invalid or unauthorized', code: 'MODEL_API_KEY_INVALID' });
      }
      const message = err?.message ? String(err.message) : '';
      if (message.includes('provider must be')) {
        throw new BadRequestException({ error: message });
      }
      console.error('[users] list model provider models failed', err);
      throw new InternalServerErrorException({ error: 'Failed to list model provider models' });
    }
  }

  @Get('me/api-tokens')
  @ApiOperation({
    summary: 'List my API tokens',
    description: 'Returns redacted API tokens for the current user.',
    operationId: 'users_list_api_tokens'
  })
  @ApiOkResponse({ description: 'OK', type: ListUserApiTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async listMyApiTokens(@Req() req: Request) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const tokens = await this.apiTokenService.listTokens(req.user.id);
      return { tokens };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[users] list api tokens failed', err);
      throw new InternalServerErrorException({ error: 'Failed to list api tokens' });
    }
  }

  @Post('me/api-tokens')
  @ApiOperation({
    summary: 'Create my API token',
    description: 'Issues a new API token and returns it once.',
    operationId: 'users_create_api_token'
  })
  @ApiOkResponse({ description: 'OK', type: CreateUserApiTokenResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  async createMyApiToken(@Req() req: Request, @Body() body: CreateUserApiTokenDto) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const result = await this.apiTokenService.createToken(req.user.id, body);
      // Log API token creation without recording the token secret. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'User API token created',
        code: 'USER_API_TOKEN_CREATED',
        actorUserId: req.user.id,
        meta: { tokenId: result.apiToken.id, name: result.apiToken.name ?? null, scopes: result.apiToken.scopes ?? [] }
      });
      return { token: result.token, apiToken: result.apiToken };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : '';
      if (message.includes('api token') || message.includes('expiresInDays')) {
        throw new BadRequestException({ error: message });
      }
      console.error('[users] create api token failed', err);
      throw new InternalServerErrorException({ error: 'Failed to create api token' });
    }
  }

  @Patch('me/api-tokens/:id')
  @ApiOperation({
    summary: 'Update my API token',
    description: 'Updates name/scopes/expiry for the token.',
    operationId: 'users_update_api_token'
  })
  @ApiOkResponse({ description: 'OK', type: UserApiTokenResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async updateMyApiToken(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateUserApiTokenDto) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const token = await this.apiTokenService.updateToken(req.user.id, id, body);
      if (!token) throw new NotFoundException({ error: 'API token not found' });
      // Log API token updates without recording token secrets. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'info',
        message: 'User API token updated',
        code: 'USER_API_TOKEN_UPDATED',
        actorUserId: req.user.id,
        meta: { tokenId: token.id, name: token.name ?? null, scopes: token.scopes ?? [] }
      });
      return { apiToken: token };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : '';
      if (message.includes('api token') || message.includes('expiresInDays')) {
        throw new BadRequestException({ error: message });
      }
      console.error('[users] update api token failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update api token' });
    }
  }

  @Post('me/api-tokens/:id/revoke')
  @ApiOperation({
    summary: 'Revoke my API token',
    description: 'Revokes an API token so it can no longer be used.',
    operationId: 'users_revoke_api_token'
  })
  @ApiOkResponse({ description: 'OK', type: UserApiTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Not Found', type: ErrorResponseDto })
  async revokeMyApiToken(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
      const token = await this.apiTokenService.revokeToken(req.user.id, id);
      if (!token) throw new NotFoundException({ error: 'API token not found' });
      // Log API token revocations for audit trails. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void this.logWriter.logOperation({
        level: 'warn',
        message: 'User API token revoked',
        code: 'USER_API_TOKEN_REVOKED',
        actorUserId: req.user.id,
        meta: { tokenId: token.id }
      });
      return { apiToken: token };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error('[users] revoke api token failed', err);
      throw new InternalServerErrorException({ error: 'Failed to revoke api token' });
    }
  }
}
