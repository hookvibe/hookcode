/**
 * Env helpers (Vite + tests):
 * - Business context: Frontend / Configuration.
 * - Purpose: read feature flags from Vite `import.meta.env` while keeping unit tests ergonomic.
 *
 * Notes:
 * - In browser builds, `process.env` is not available; Vite injects `VITE_*` into `import.meta.env` at build time.
 * - In unit tests (Vitest), we prefer `process.env` when present so tests can toggle flags without rebuilding.
 *
 * Change record:
 * - 2026-01-15: Introduced `getBooleanEnv` for feature toggles (e.g. disabling account editing UI).
 */

const normalizeEnvValue = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export const getEnvValue = (key: string): string | undefined => {
  // Test/runtime ergonomics (2026-01-15):
  // - Prefer `process.env` when available so Vitest can toggle flags at runtime.
  // - Fall back to Vite `import.meta.env` for browser builds and regular Vite-powered dev.
  if (typeof process !== 'undefined' && process?.env) {
    const fromProcess = process.env[key];
    if (fromProcess !== undefined) return String(fromProcess);
  }

  const metaEnv = (import.meta as any)?.env as Record<string, unknown> | undefined;
  const fromVite = metaEnv?.[key];
  if (fromVite === undefined) return undefined;
  return String(fromVite);
};

export const getBooleanEnv = (key: string, defaultValue: boolean): boolean => {
  const raw = getEnvValue(key);
  const normalized = normalizeEnvValue(raw);
  if (!normalized) return defaultValue;

  if (['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(normalized)) return false;

  // Safety: if the value is not a known boolean literal, do not surprise users.
  return defaultValue;
};

