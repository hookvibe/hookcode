const TRANSIENT_DB_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  // PostgreSQL transient server/connection interruption errors.
  '57P01',
  '57P02',
  '57P03',
  '53300'
]);

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
};

const toErrorCode = (value: unknown): string | null => {
  const raw = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const normalized = raw.trim().toUpperCase();
  return normalized || null;
};

const getErrorCode = (err: unknown): string | null => {
  if (!err || typeof err !== 'object') return null;
  return toErrorCode((err as ErrorLike).code);
};

export const isTransientDbBootstrapError = (err: unknown): boolean => {
  // Classify startup DB errors to retry only on transport-level interruptions. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
  const visited = new Set<unknown>();
  let cursor: unknown = err;
  let depth = 0;
  while (cursor && typeof cursor === 'object' && depth < 6 && !visited.has(cursor)) {
    visited.add(cursor);
    const code = getErrorCode(cursor);
    if (code && TRANSIENT_DB_ERROR_CODES.has(code)) return true;
    const message = String((cursor as ErrorLike).message ?? '');
    if (/\bECONNRESET\b/i.test(message) || /\bETIMEDOUT\b/i.test(message)) return true;
    cursor = (cursor as ErrorLike).cause;
    depth += 1;
  }
  return false;
};

export const getSchemaRetryAttempts = (): number => {
  const raw = Number(process.env.HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS ?? 3);
  if (!Number.isFinite(raw)) return 3;
  const normalized = Math.floor(raw);
  if (normalized < 1) return 1;
  return Math.min(normalized, 10);
};

export const getSchemaRetryBaseDelayMs = (): number => {
  const raw = Number(process.env.HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS ?? 1000);
  if (!Number.isFinite(raw)) return 1000;
  const normalized = Math.floor(raw);
  if (normalized < 100) return 100;
  return Math.min(normalized, 10_000);
};

export const getSchemaRetryDelayMs = (attemptIndex: number, baseDelayMs: number): number => {
  // Use bounded linear backoff to reduce DB reconnect bursts during transient outages. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
  const safeAttempt = Number.isFinite(attemptIndex) ? Math.max(1, Math.floor(attemptIndex)) : 1;
  const safeBase = Number.isFinite(baseDelayMs) ? Math.max(100, Math.floor(baseDelayMs)) : 1000;
  return Math.min(safeBase * safeAttempt, 15_000);
};
