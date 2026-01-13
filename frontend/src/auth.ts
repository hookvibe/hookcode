import { isInAppHash } from './navHistory';

export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  roles?: string[];
}

/**
 * Frontend Chat auth state (localStorage + sessionStorage):
 * - Business context: Frontend Chat needs to call HookCode backend APIs that require Bearer auth.
 * - Design goal: keep storage keys compatible with the legacy frontend so users don't need to login twice.
 *
 * Usage:
 * - API client attaches token from `getToken()` (see `frontend-chat/src/api.ts`).
 * - UI can listen to `AUTH_CHANGED_EVENT` to react to login/logout changes.
 *
 * Change record:
 * - 2026-01-11: Migrated auth storage logic from the legacy frontend to enable backend-connected pages.
 * - 2026-01-12: Harden login-next handling: store/consume only safe in-app hashes and ignore legacy invalid values
 *              (e.g. `#/login`) to avoid post-login redirect loops.
 * - 2026-01-12: Make `clearAuth()` idempotent so repeated 401 handlers do not trigger infinite auth state refresh loops.
 */
export const AUTH_TOKEN_KEY = 'hookcode-token';
export const AUTH_USER_KEY = 'hookcode-user';
export const AUTH_CHANGED_EVENT = 'hookcode-auth-changed';
export const LOGIN_NEXT_KEY = 'hookcode-login-next';
export const VERIFY_EMAIL_NEXT_KEY = 'hookcode-verify-email';

const emitAuthChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setToken = (token: string) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  emitAuthChanged();
};

export const getStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.id !== 'string' || typeof parsed.username !== 'string') return null;
    return parsed as AuthUser;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: AuthUser | null) => {
  if (!user) {
    localStorage.removeItem(AUTH_USER_KEY);
    emitAuthChanged();
    return;
  }
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  emitAuthChanged();
};

export const clearAuth = () => {
  // Auth UX/safety:
  // - `api.ts` redirects to `#/login` on 401 and calls `clearAuth()`.
  // - When already logged out (no token/user in storage), re-emitting `AUTH_CHANGED_EVENT` can create a tight loop:
  //   `AUTH_CHANGED_EVENT` -> `fetchAuthMe()` -> 401 -> `clearAuth()` -> `AUTH_CHANGED_EVENT` -> ...
  // - Keep `clearAuth()` idempotent to prevent a 401 storm from pegging CPU and spamming console errors.
  const hadToken = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
  const hadUser = Boolean(localStorage.getItem(AUTH_USER_KEY));
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  if (hadToken || hadUser) emitAuthChanged();
};

export const saveLoginNext = (hash: string) => {
  if (typeof window === 'undefined') return;
  const normalized = (hash || '').trim();
  // Navigation safety:
  // - Keep redirects inside the SPA (hash routing) to avoid surprising cross-origin navigations.
  // - Drop `#/login` to prevent login redirect loops when legacy values are present.
  if (!isInAppHash(normalized)) return;
  sessionStorage.setItem(LOGIN_NEXT_KEY, normalized);
};

export const consumeLoginNext = (): string | null => {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem(LOGIN_NEXT_KEY);
  if (!value) return null;
  sessionStorage.removeItem(LOGIN_NEXT_KEY);
  const normalized = String(value ?? '').trim();
  // Compatibility/safety:
  // - Users may carry legacy sessionStorage values (e.g. `#/login`) across deployments.
  // - Ignore anything that is not a safe in-app hash, falling back to `#/` in the login page.
  return isInAppHash(normalized) ? normalized : null;
};

export const saveVerifyEmailAddress = (email: string) => {
  if (typeof window === 'undefined') return;
  const normalized = (email || '').trim();
  if (!normalized) return;
  sessionStorage.setItem(VERIFY_EMAIL_NEXT_KEY, normalized);
};

export const getVerifyEmailAddress = (): string | null => {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem(VERIFY_EMAIL_NEXT_KEY);
  return value ? value : null;
};

export const clearVerifyEmailAddress = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(VERIFY_EMAIL_NEXT_KEY);
};
