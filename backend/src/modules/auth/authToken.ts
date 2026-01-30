import type { Request } from 'express';

const extractBearer = (header?: string): string | null => {
  if (!header) return null;
  const raw = header.trim();
  const m = /^bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() ? m[1].trim() : null;
};

const extractCookieToken = (cookieHeader?: string, name?: string): string | null => {
  if (!cookieHeader || !name) return null;
  const entries = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
  for (const entry of entries) {
    if (!entry.startsWith(`${name}=`)) continue;
    const value = entry.slice(name.length + 1);
    return value ? decodeURIComponent(value) : null;
  }
  return null;
};

export const extractAuthToken = (req: Request, options?: { allowQueryToken?: boolean }): string | null => {
  const allowQueryToken = options?.allowQueryToken === true;
  // Accept preview auth cookies for iframe asset requests. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const cookieToken = extractCookieToken(req.header('cookie'), 'hookcode-preview-token');
  const token =
    extractBearer(req.header('authorization')) ||
    (req.header('x-hookcode-token') ?? '').trim() ||
    cookieToken ||
    (allowQueryToken && typeof req.query?.token === 'string' ? req.query.token.trim() : '') ||
    null;

  return token && token.trim() ? token.trim() : null;
};
