export const parsePositiveInt = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
};

export const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  // Normalize boolean-like query params for performance toggles. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const raw = value.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return undefined;
};
