import type { Request } from 'express';

const extractBearer = (header?: string): string | null => {
  if (!header) return null;
  const raw = header.trim();
  const m = /^bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() ? m[1].trim() : null;
};

export const extractAuthToken = (req: Request, options?: { allowQueryToken?: boolean }): string | null => {
  const allowQueryToken = options?.allowQueryToken === true;
  const token =
    extractBearer(req.header('authorization')) ||
    (req.header('x-hookcode-token') ?? '').trim() ||
    (allowQueryToken && typeof req.query?.token === 'string' ? req.query.token.trim() : '') ||
    null;

  return token && token.trim() ? token.trim() : null;
};
