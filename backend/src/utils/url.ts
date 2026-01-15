/**
 * URL utils (shared):
 * - Business context: credentials often include a user-provided API Base URL (proxy).
 * - Safety: refuse invalid URLs and disallow embedded credentials (username/password).
 *
 * Change record:
 * - 2026-01-14: Introduced `normalizeHttpBaseUrl` to validate provider API Base URLs consistently.
 */

export const normalizeHttpBaseUrl = (raw: unknown): string | undefined => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return undefined;
  if (/\s/.test(trimmed)) return undefined;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    // Safety: avoid embedding credentials in URLs (may leak via logs/prompt context).
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

