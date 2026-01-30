import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { issueToken, isAuthEnabled } from '../../auth/authService';
import { isTaskLogsEnabled } from '../../config/features';
import { UserService } from '../users/user.service';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthScopeGroup, Public } from './auth.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthMeResponseDto } from './dto/auth-me-response.dto';

@AuthScopeGroup('account') // Scope auth endpoints for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in',
    description: 'Sign in with username and password.',
    operationId: 'auth_login'
  })
  @ApiOkResponse({ description: 'OK', type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async login(@Body() body: LoginDto) {
    if (!isAuthEnabled()) {
      throw new BadRequestException({ error: 'Auth is disabled' });
    }

    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username.trim() || !password) {
      throw new BadRequestException({ error: 'Missing username or password' });
    }

    const result = await this.userService.verifyPasswordDetailed(username, password);
    if (!result.ok) {
      if (result.reason === 'disabled') {
        throw new ForbiddenException({ error: 'Account is disabled' });
      }
      throw new UnauthorizedException({ error: 'Invalid username or password' });
    }

    const user = result.user;
    const { token, expiresAt } = issueToken({ ...user, roles: [] });
    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roles: []
      }
    };
  }

  @Get('me')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the current authenticated user and feature flags.',
    operationId: 'auth_me'
  })
  @ApiOkResponse({ description: 'OK', type: AuthMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponseDto })
  me(@Req() req: Request) {
    if (!isAuthEnabled()) {
      return { authEnabled: false, user: null, features: { taskLogsEnabled: isTaskLogsEnabled() } };
    }
    if (!req.user) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    return {
      authEnabled: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        roles: req.user.roles ?? []
      },
      features: { taskLogsEnabled: isTaskLogsEnabled() },
      token: req.auth
        ? {
            iat: req.auth.iat,
            exp: req.auth.exp
          }
        : undefined
    };
  }
}
