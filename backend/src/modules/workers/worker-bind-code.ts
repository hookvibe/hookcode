import { hashToken } from '../../utils/token';

const WORKER_BIND_CODE_PREFIX = 'hcw1.';
const WORKER_BIND_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export interface WorkerBindCodePayload {
  workerId: string;
  backendUrl: string;
  secret: string;
}

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
};

export const buildWorkerBindCode = (payload: WorkerBindCodePayload): string => {
  const normalized = {
    v: 1,
    workerId: trimString(payload.workerId),
    backendUrl: trimString(payload.backendUrl).replace(/\/+$/g, ''),
    secret: trimString(payload.secret)
  };
  return `${WORKER_BIND_CODE_PREFIX}${encodeBase64Url(JSON.stringify(normalized))}`;
};

export const parseWorkerBindCode = (bindCode: string): WorkerBindCodePayload | null => {
  const raw = trimString(bindCode);
  if (!raw.startsWith(WORKER_BIND_CODE_PREFIX)) return null;
  try {
    const decoded = JSON.parse(decodeBase64Url(raw.slice(WORKER_BIND_CODE_PREFIX.length))) as {
      v?: unknown;
      workerId?: unknown;
      backendUrl?: unknown;
      secret?: unknown;
    };
    if (Number(decoded?.v) !== 1) return null;
    const workerId = trimString(decoded?.workerId);
    const backendUrl = trimString(decoded?.backendUrl).replace(/\/+$/g, '');
    const secret = trimString(decoded?.secret);
    if (!workerId || !backendUrl || !secret) return null;
    return { workerId, backendUrl, secret };
  } catch {
    return null;
  }
};

export const hashWorkerBindCodeSecret = (secret: string): string => hashToken(trimString(secret));

export const buildWorkerBindCodeExpiresAt = (now = new Date()): Date => new Date(now.getTime() + WORKER_BIND_CODE_TTL_MS);

export const isWorkerBindCodeExpired = (expiresAt?: Date | string | null, now = new Date()): boolean => {
  if (!expiresAt) return true;
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
};
