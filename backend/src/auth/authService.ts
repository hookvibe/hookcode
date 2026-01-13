import fs from 'fs';
import path from 'path';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { isTruthy } from '../utils/env';

/**
 * Lightweight auth (no third-party dependencies):
 * - issue/verify token uses a simplified "payload(base64url).signature(HMAC-SHA256)" scheme (not JWT, but similar purpose).
 * - Used by `backend/src/routes/auth.ts` to issue login tokens
 * - Used by `backend/src/middlewares/auth.ts` to verify tokens and populate `req.user` / `req.auth`
 */
export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  roles: string[];
}

export interface AuthTokenPayload {
  sub: string;
  username?: string;
  iat: number;
  exp: number;
}

const base64UrlEncode = (input: Buffer | string): string => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const base64UrlDecodeToBuffer = (input: string): Buffer => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
};

const getNowSeconds = () => Math.floor(Date.now() / 1000);

export const isAuthEnabled = (): boolean => isTruthy(process.env.AUTH_ENABLED, true);

export const isHealthAuthExempt = (): boolean =>
  isTruthy(process.env.AUTH_EXEMPT_HEALTH, true);

export const isAuthRegisterEnabled = (): boolean =>
  isTruthy(process.env.AUTH_REGISTER_ENABLED, false);

export const isAuthRegisterRequireEmailVerify = (): boolean =>
  isTruthy(process.env.AUTH_REGISTER_REQUIRE_EMAIL_VERIFY, true);

const getTokenTtlSeconds = (): number => {
  const raw = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 0);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 7 * 24 * 60 * 60; // 7 days
};

let cachedSecret: string | null = null;

const resolveAuthTokenSecretFilePath = (): string => {
  const raw = String(process.env.HOOKCODE_AUTH_TOKEN_SECRET_FILE ?? '').trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  }
  return path.join(process.cwd(), '.cache', 'hookcode', 'auth-token-secret');
};

const readSecretFromFile = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
};

const shouldUseSecretFileFallback = (): boolean => {
  const explicit = String(process.env.HOOKCODE_AUTH_TOKEN_SECRET_FILE ?? '').trim();
  if (explicit) return true;
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
  return nodeEnv !== 'production';
};

export const getAuthTokenSecret = (): string => {
  if (cachedSecret) return cachedSecret;
  const fromEnv = (process.env.AUTH_TOKEN_SECRET ?? '').trim();
  if (fromEnv) {
    cachedSecret = fromEnv;
    return fromEnv;
  }

  if (shouldUseSecretFileFallback()) {
    const filePath = resolveAuthTokenSecretFilePath();
    const fromFile = readSecretFromFile(filePath);
    if (fromFile) {
      cachedSecret = fromFile;
      return fromFile;
    }

    const generated = randomBytes(32).toString('hex');
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${generated}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      cachedSecret = generated;
      console.warn(
        `[auth] AUTH_TOKEN_SECRET is not configured; created a dev secret file at "${filePath}" (tokens will remain valid across restarts)`
      );
      return generated;
    } catch (err: any) {
      if (err?.code === 'EEXIST') {
        const retry = readSecretFromFile(filePath);
        if (retry) {
          cachedSecret = retry;
          return retry;
        }
      }
      cachedSecret = generated;
      console.warn(
        '[auth] AUTH_TOKEN_SECRET is not configured; failed to persist a dev secret file; using a temporary random secret (tokens will be invalid after restart)'
      );
      return generated;
    }
  }

  const generated = randomBytes(32).toString('hex');
  cachedSecret = generated;
  console.warn('[auth] AUTH_TOKEN_SECRET is not configured; using a temporary random secret (tokens will be invalid after restart)');
  return generated;
};

const hmacSha256 = (secret: string, value: string): Buffer =>
  createHmac('sha256', secret).update(value).digest();

const signPayload = (payloadPart: string): string => {
  const secret = getAuthTokenSecret();
  const sig = hmacSha256(secret, payloadPart);
  return base64UrlEncode(sig);
};

const constantTimeEqual = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

export const issueToken = (user: AuthUser): { token: string; expiresAt: string } => {
  const now = getNowSeconds();
  const ttl = getTokenTtlSeconds();
  const payload: AuthTokenPayload = {
    sub: user.id,
    username: user.username,
    iat: now,
    exp: now + ttl
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const sigPart = signPayload(payloadPart);
  const token = `${payloadPart}.${sigPart}`;
  return { token, expiresAt: new Date(payload.exp * 1000).toISOString() };
};

export const verifyToken = (token: string): AuthTokenPayload => {
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Invalid token format');
  const [payloadPart, sigPart] = parts;

  const expectedSig = signPayload(payloadPart);
  if (!constantTimeEqual(expectedSig, sigPart)) throw new Error('Invalid token signature');

  const payloadJson = base64UrlDecodeToBuffer(payloadPart).toString('utf8');
  const parsed = JSON.parse(payloadJson) as Partial<AuthTokenPayload>;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid token payload');

  const exp = Number(parsed.exp);
  if (!Number.isFinite(exp) || exp <= 0) throw new Error('Invalid token exp');
  if (getNowSeconds() >= exp) throw new Error('Token expired');

  const username = typeof parsed.username === 'string' ? parsed.username : '';
  const sub = typeof parsed.sub === 'string' ? parsed.sub : '';
  const iat = Number(parsed.iat);

  if (!sub) throw new Error('Invalid token subject');

  return {
    sub,
    username: username || undefined,
    iat: Number.isFinite(iat) ? iat : 0,
    exp
  };
};
