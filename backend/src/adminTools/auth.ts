import type { Request, Response } from 'express';
import type { AuthTokenPayload } from '../auth/authService';

export const ADMIN_TOOLS_TOKEN_QUERY_KEY = 'token';
export const ADMIN_TOOLS_TOKEN_COOKIE_NAME = 'hookcode_admin_tools_token';

export interface AdminToolsUser {
  id: string;
  username: string;
  displayName?: string;
  disabled?: boolean;
}

export interface AdminToolsAuthDeps {
  verifyToken: (token: string) => AuthTokenPayload;
  getUserById: (id: string) => Promise<AdminToolsUser | null>;
}

export interface AdminToolsAuthContext {
  token: string;
  payload: AuthTokenPayload;
  user: AdminToolsUser;
}

const extractBearer = (header?: string): string | null => {
  if (!header) return null;
  const raw = header.trim();
  const m = /^bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() ? m[1].trim() : null;
};

export const parseCookieHeader = (cookieHeader?: string): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    result[key] = decodeURIComponent(value);
  }
  return result;
};

export const extractAdminToolsToken = (req: Request, cookieName = ADMIN_TOOLS_TOKEN_COOKIE_NAME): string | null => {
  const fromBearer = extractBearer(req.header('authorization'));
  if (fromBearer) return fromBearer;

  const fromHeader = (req.header('x-hookcode-token') ?? '').trim();
  if (fromHeader) return fromHeader;

  const cookies = parseCookieHeader(req.header('cookie'));
  const fromCookie = (cookies[cookieName] ?? '').trim();
  return fromCookie || null;
};

export const authenticateAdminTools = async (
  req: Request,
  deps: AdminToolsAuthDeps,
  cookieName = ADMIN_TOOLS_TOKEN_COOKIE_NAME
): Promise<
  | { ok: true; ctx: AdminToolsAuthContext }
  | { ok: false; status: 401; error: string; message?: string }
> => {
  const token = extractAdminToolsToken(req, cookieName);
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  let payload: AuthTokenPayload;
  try {
    payload = deps.verifyToken(token);
  } catch (err: any) {
    const message = err?.message ? String(err.message) : 'Invalid token';
    return { ok: false, status: 401, error: 'Unauthorized', message };
  }

  const user = await deps.getUserById(payload.sub);
  if (!user || user.disabled) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true, ctx: { token, payload, user } };
};

export const setAdminToolsAuthCookie = (
  res: Response,
  params: { token: string; payload: AuthTokenPayload; cookieName?: string; secure?: boolean }
) => {
  const maxAgeSeconds = Math.max(0, Math.floor(params.payload.exp - Date.now() / 1000));
  res.cookie(params.cookieName ?? ADMIN_TOOLS_TOKEN_COOKIE_NAME, params.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(params.secure),
    path: '/',
    maxAge: maxAgeSeconds * 1000
  });
};

export const clearAdminToolsAuthCookie = (
  res: Response,
  params?: { cookieName?: string; secure?: boolean }
) => {
  res.clearCookie(params?.cookieName ?? ADMIN_TOOLS_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(params?.secure),
    path: '/'
  });
};
