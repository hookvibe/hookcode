import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { Request } from 'express';
import { issueToken, isAuthEnabled, isAuthRegisterEnabled, isAuthRegisterRequireEmailVerify } from '../../auth/authService';
import { isTaskLogsEnabled } from '../../config/features';
import { UserService } from '../users/user.service';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SuccessResponseDto } from '../common/dto/basic-response.dto';
import { AuthScopeGroup, Public } from './auth.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthMeResponseDto } from './dto/auth-me-response.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';

@AuthScopeGroup('account') // Scope auth endpoints for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly emailVerificationService: EmailVerificationService
  ) {}

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
    // Enforce verified email before login when required. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (isAuthRegisterRequireEmailVerify() && user.email && !user.emailVerifiedAt) {
      throw new ForbiddenException({ error: 'Email is not verified', code: 'EMAIL_NOT_VERIFIED' });
    }
    const { token, expiresAt } = issueToken({ ...user, roles: user.roles ?? [] });
    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        roles: user.roles ?? []
      }
    };
  }

  @Post('register')
  @Public()
  @HttpCode(200)
  // Add registration endpoint with email verification flow. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  @ApiOperation({
    summary: 'Register account',
    description: 'Create a new user account.',
    operationId: 'auth_register'
  })
  @ApiOkResponse({ description: 'OK', type: RegisterResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Conflict', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ErrorResponseDto })
  async register(@Body() body: RegisterDto) {
    if (!isAuthEnabled()) {
      throw new BadRequestException({ error: 'Auth is disabled' });
    }
    if (!isAuthRegisterEnabled()) {
      throw new ForbiddenException({ error: 'Registration is disabled' });
    }

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';

    if (!username || !email || !password) {
      throw new BadRequestException({ error: 'Missing username, email, or password' });
    }

    const requiresVerify = isAuthRegisterRequireEmailVerify();
    let created;
    try {
      created = await this.userService.createUser({
        username,
        email,
        password,
        displayName: displayName || undefined,
        roles: [],
        emailVerifiedAt: requiresVerify ? null : new Date().toISOString()
      });
    } catch (err: any) {
      const message = err?.message ? String(err.message) : '';
      // Map unique user conflicts to a stable 409 response for registration UX. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (message.includes('already exists')) {
        throw new ConflictException({ error: message });
      }
      throw err;
    }

    if (requiresVerify) {
      const { token, expiresAt } = await this.emailVerificationService.createToken({ userId: created.id, email });
      await this.emailVerificationService.sendVerificationEmail({ email, token });
      return { status: 'pending_verification', email, expiresAt: expiresAt.toISOString() };
    }

    const { token, expiresAt } = issueToken({ ...created, roles: created.roles ?? [] });
    return {
      status: 'ok',
      token,
      expiresAt,
      user: {
        id: created.id,
        username: created.username,
        displayName: created.displayName,
        email: created.email,
        emailVerifiedAt: created.emailVerifiedAt,
        roles: created.roles ?? []
      }
    };
  }

  @Post('verify-email')
  @Public()
  @HttpCode(200)
  // Verify email tokens issued during registration. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  @ApiOperation({
    summary: 'Verify email',
    description: 'Verify a registration email token.',
    operationId: 'auth_verify_email'
  })
  @ApiOkResponse({ description: 'OK', type: SuccessResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request', type: ErrorResponseDto })
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!email || !token) {
      throw new BadRequestException({ error: 'Missing email or token' });
    }

    const result = await this.emailVerificationService.verifyToken({ email, token });
    this.emailVerificationService.ensureVerified(result);
    return { success: true };
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
        email: req.user.email,
        emailVerifiedAt: req.user.emailVerifiedAt,
        roles: req.user.roles ?? []
      },
      features: {
        taskLogsEnabled: isTaskLogsEnabled(),
        registerEnabled: isAuthRegisterEnabled(),
        registerRequireEmailVerify: isAuthRegisterRequireEmailVerify()
      },
      token: req.auth
        ? {
            iat: req.auth.iat,
            exp: req.auth.exp
          }
        : undefined
    };
  }
}
