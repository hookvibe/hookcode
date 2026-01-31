import { CanActivate, ExecutionContext, ForbiddenException, Injectable, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isAuthEnabled, isHealthAuthExempt, verifyToken } from '../../auth/authService';
import { ALLOW_QUERY_TOKEN_KEY, AUTH_SCOPE_GROUP_KEY, AUTH_SCOPE_LEVEL_KEY, IS_HEALTH_CHECK_KEY, IS_PUBLIC_KEY } from './auth.decorator';
import { extractAuthToken } from './authToken';
import { AuthUserLoader } from './auth-user-loader';
import { UserApiTokenService } from '../users/user-api-token.service';
import { hasPatScope, isPatScopeGroup, type PatScopeGroup, type PatScopeLevel } from './patScopes';
import type { AuthContext } from './authContext';

const PAT_PREFIX = 'hcpat_';

// Map HTTP verbs to PAT read/write enforcement levels. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
const isReadMethod = (method: string): boolean => ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authUserLoader: AuthUserLoader,
    private readonly apiTokenService: UserApiTokenService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const isHealthCheck = this.reflector.getAllAndOverride<boolean>(IS_HEALTH_CHECK_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!isAuthEnabled()) return true;
    if (isHealthCheck && isHealthAuthExempt()) return true;

    const allowQueryToken = this.reflector.getAllAndOverride<boolean>(ALLOW_QUERY_TOKEN_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const req = context.switchToHttp().getRequest<Request>();
    const token = extractAuthToken(req, { allowQueryToken: Boolean(allowQueryToken) });
    if (!token) {
      throw new HttpException({ error: 'Unauthorized' }, 401);
    }

    let authContext: AuthContext;
    if (token.startsWith(PAT_PREFIX)) {
      // Accept PAT tokens for API access when prefixed. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
      const verified = await this.apiTokenService.verifyToken(token, { ip: req.ip });
      if (!verified) {
        throw new HttpException({ error: 'Unauthorized', message: 'Invalid token' }, 401);
      }
      authContext = verified.auth;
    } else {
      try {
        const payload = verifyToken(token);
        authContext = { ...payload, tokenType: 'session' };
      } catch (err: any) {
        const message = err?.message ? String(err.message) : 'Invalid token';
        throw new HttpException({ error: 'Unauthorized', message }, 401);
      }
    }

    let user: any;
    try {
      user = await this.authUserLoader.loadUser(authContext.sub);
    } catch (err) {
      console.error('[auth] AuthGuard user load failed', err);
      throw new ServiceUnavailableException({ error: 'Service Unavailable' });
    }
    if (!user) {
      throw new HttpException({ error: 'Unauthorized' }, 401);
    }

    req.user = user;
    req.auth = authContext as any;

    if (authContext.tokenType === 'pat') {
      const scopeGroup = this.reflector.getAllAndOverride<PatScopeGroup | undefined>(AUTH_SCOPE_GROUP_KEY, [
        context.getHandler(),
        context.getClass()
      ]);
      const scopeLevelOverride = this.reflector.getAllAndOverride<PatScopeLevel | undefined>(AUTH_SCOPE_LEVEL_KEY, [
        context.getHandler(),
        context.getClass()
      ]);
      const requiredLevel = scopeLevelOverride ?? (isReadMethod(req.method) ? 'read' : 'write');
      if (!scopeGroup || !isPatScopeGroup(scopeGroup)) {
        // Reject PAT access to unmapped or disallowed scope groups. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
        throw new ForbiddenException({ error: 'Forbidden', code: 'PAT_SCOPE_REQUIRED' });
      }
      if (!hasPatScope(authContext.scopes, scopeGroup, requiredLevel)) {
        throw new ForbiddenException({ error: 'Forbidden', code: 'PAT_SCOPE_INSUFFICIENT' });
      }
    }
    return true;
  }
}
