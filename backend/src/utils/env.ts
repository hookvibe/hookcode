export const isTruthy = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) return defaultValue;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'n' || raw === 'off') return false;
  return defaultValue;
};

// Parse optional duration values so blank/zero can explicitly disable timeouts. docs/en/developer/plans/stale-disable-20260305/task_plan.md stale-disable-20260305
export const parseOptionalDurationMs = (value: string | undefined, fallbackMs: number): number | null => {
  if (value === undefined) return fallbackMs;
  const raw = String(value).trim();
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallbackMs;
  if (num === 0) return null;
  if (num < 0) return fallbackMs;
  return num;
};
