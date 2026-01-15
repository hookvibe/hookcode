import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Patch,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateModelCredentialsDto } from './dto/update-model-credentials.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SuccessResponseDto } from '../common/dto/basic-response.dto';
import { PatchMeResponseDto } from './dto/patch-me-response.dto';
import { ModelCredentialsResponseDto } from './dto/model-credentials.dto';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
export class UsersController {
  constructor(private readonly userService: UserService) {}

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
      return { credentials };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      const message = err?.message ? String(err.message) : '';
      if (message.includes('repo provider credential profile remark is required') || message.includes('model provider credential profile remark is required')) {
        throw new BadRequestException({ error: message });
      }
      console.error('[users] update model credentials failed', err);
      throw new InternalServerErrorException({ error: 'Failed to update model credentials' });
    }
  }
}
