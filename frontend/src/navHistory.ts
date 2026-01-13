/**
 * In-app navigation history helper (hash router).
 *
 * Business context:
 * - Module: Frontend Chat / Navigation.
 * - Purpose:
 *   - Provide a safe "header back" behavior for detail pages (Task/Repo) without relying purely on browser history.
 *   - Allow sidebar-driven navigation to "cut off" the back chain so users don't jump back to unrelated pages.
 *
 * Key ideas:
 * - Keep a lightweight `prevHashForBack` that represents the last in-app hash we consider safe for the header back icon.
 * - Sidebar navigation marks the next route change as `source=sidebar`; when the router observes it, it clears
 *   `prevHashForBack` so the header back falls back to a stable route.
 *
 * Change record:
 * - 2026-01-12: Introduced to port legacy frontend header-back behavior into `frontend-chat`
 *              and reset the back chain on sidebar navigation.
 */

export type NavigationSource = 'sidebar' | 'content' | 'unknown';

let pendingSource: NavigationSource | null = null;
let prevHashForBack = '';

export const isInAppHash = (hash: string): boolean => {
  const normalized = String(hash ?? '').trim();
  if (!normalized || normalized === '#') return false;
  if (!normalized.startsWith('#/')) return false;
  // Safety: avoid "back" crossing into the login redirect loop.
  if (normalized.startsWith('#/login')) return false;
  return true;
};

export const markNextNavigationSource = (source: NavigationSource): void => {
  pendingSource = source;
};

export const consumeNextNavigationSource = (): NavigationSource => {
  const source = pendingSource ?? 'unknown';
  pendingSource = null;
  return source;
};

export const getPrevHashForBack = (): string => prevHashForBack;

export const setPrevHashForBack = (hash: string): void => {
  prevHashForBack = String(hash ?? '');
};

/**
 * Sidebar navigation helper.
 *
 * Usage:
 * - Call this before changing `window.location.hash` from the left sidebar (global nav).
 *
 * Important pitfall:
 * - If the hash does not change, we MUST NOT keep `pendingSource`, otherwise the next navigation would be
 *   misclassified as "sidebar" and incorrectly clear the back chain.
 */
export const navigateFromSidebar = (toHash: string): void => {
  if (typeof window === 'undefined') return;
  const target = String(toHash ?? '');
  const current = String(window.location.hash ?? '');
  if (!target) return;

  if (target === current) {
    // UX rule: clicking the active sidebar item should still "reset" the header-back chain, so users do not
    // accidentally jump back to an unrelated page when they think they have re-entered the page via the sidebar.
    pendingSource = null;
    prevHashForBack = '';
    return;
  }

  pendingSource = 'sidebar';
  window.location.hash = target;
};

/**
 * Test helper: reset module-level state between tests.
 */
export const resetNavHistoryForTests = (): void => {
  pendingSource = null;
  prevHashForBack = '';
};
