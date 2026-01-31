import type { IncomingMessage } from 'http';
import type { Request } from 'express';
import { isAuthEnabled, verifyToken } from '../../auth/authService';
import { extractAuthToken } from '../auth/authToken';
import { AuthUserLoader } from '../auth/auth-user-loader';

const buildAuthRequest = (req: IncomingMessage | Request): Request => {
  // Normalize preview auth checks for HTTP + WS requests. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const maybeReq = req as Request;
  if (typeof maybeReq.header === 'function' && maybeReq.query) {
    return maybeReq;
  }
  const parsed = new URL(req.url ?? '/', 'http://local');
  return {
    header: (name: string) => {
      const value = (req.headers as any)?.[name.toLowerCase()];
      return Array.isArray(value) ? value.join(',') : value;
    },
    query: Object.fromEntries(parsed.searchParams.entries())
  } as Request;
};

export const authenticatePreviewRequest = async (
  req: IncomingMessage | Request,
  authUserLoader: AuthUserLoader
): Promise<boolean> => {
  // Share preview auth enforcement between HTTP proxy and WS upgrades. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  if (!isAuthEnabled()) return true;

  const authReq = buildAuthRequest(req);
  const token = extractAuthToken(authReq, { allowQueryToken: true });
  if (!token) return false;

  let payload: { sub: string; iat: number; exp: number };
  try {
    payload = verifyToken(token);
  } catch {
    return false;
  }

  const user = await authUserLoader.loadUser(payload.sub);
  return Boolean(user);
};
