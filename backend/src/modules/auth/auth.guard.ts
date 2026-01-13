import { CanActivate, ExecutionContext, Injectable, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isAuthEnabled, isHealthAuthExempt, verifyToken } from '../../auth/authService';
import { ALLOW_QUERY_TOKEN_KEY, IS_HEALTH_CHECK_KEY, IS_PUBLIC_KEY } from './auth.decorator';
import { extractAuthToken } from './authToken';
import { AuthUserLoader } from './auth-user-loader';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authUserLoader: AuthUserLoader) {}

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

    let payload: { sub: string; username?: string; iat: number; exp: number };
    try {
      payload = verifyToken(token);
    } catch (err: any) {
      const message = err?.message ? String(err.message) : 'Invalid token';
      throw new HttpException({ error: 'Unauthorized', message }, 401);
    }

    let user: any;
    try {
      user = await this.authUserLoader.loadUser(payload.sub);
    } catch (err) {
      console.error('[auth] AuthGuard user load failed', err);
      throw new ServiceUnavailableException({ error: 'Service Unavailable' });
    }
    if (!user) {
      throw new HttpException({ error: 'Unauthorized' }, 401);
    }

    req.user = user;
    req.auth = payload as any;
    return true;
  }
}
