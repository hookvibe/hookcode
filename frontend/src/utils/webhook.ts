import { getEnvValue } from './env';

/**
 * Webhook URL helper:
 * - Business context: Repo/Webhook UI needs a stable, human-readable full URL.
 * - Behavior: combine a relative webhook path with API base (VITE_API_BASE_URL or `/api`) and current origin.
 * - Change record (2026-01-15): extracted from RepoDetail to reuse across pages and keep URL formatting consistent.
 * - Usage: UI display only; do not treat as a security boundary or request signer.
 */
export const buildWebhookUrl = (webhookPath: string): string => {
  const rawPath = typeof webhookPath === 'string' ? webhookPath.trim() : '';
  if (!rawPath) return '';

  try {
    const rawApiBase = getEnvValue('VITE_API_BASE_URL') || '/api';
    const apiBase = typeof rawApiBase === 'string' && rawApiBase.trim() ? rawApiBase.trim() : '/api';
    const base = apiBase.startsWith('http') ? apiBase : new URL(apiBase, window.location.origin).toString();
    return new URL(rawPath, base).toString();
  } catch {
    return rawPath;
  }
};
