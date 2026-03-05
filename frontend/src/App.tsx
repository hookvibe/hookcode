/**
 * Frontend Chat (SPA) entry:
 * - Business context: migrate HookCode console UI into `frontend-chat` while keeping static hosting and the existing build pipeline.
 * - Routing: uses hash routing so static hosting needs no server-side rewrite.
 *
 * Change record:
 * - 2026-01-11: Make `#/` the chat home, keep `#/chat` as an alias, and add task/task-group routes.
 * - 2026-01-12: Track an in-app "previous hash" for the header back icon; sidebar navigation clears the back chain.
 * - 2026-01-12: Tune Ant Design global tokens (radius) so default components match the modern UI style.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { getAntdLocale, useLocale, useT } from './i18n';
import { NEUTRAL_ACCENT } from './theme/accent';
import { consumeNextNavigationSource, setPrevHashForBack } from './navHistory';
import { parseRoute } from './router';
import { AppShell, type ThemePreference } from './pages/AppShell';

const THEME_STORAGE_KEY = 'hookcode-theme';
const ACCENT_VAR_PRIMARY = '--accent';
const ACCENT_VAR_HOVER = '--accent-hover';
const ACCENT_VAR_ACTIVE = '--accent-active';
// Keep a single neutral accent to match the flat palette. docs/en/developer/plans/uiuxflat20260203/task_plan.md uiuxflat20260203
const ACCENT = NEUTRAL_ACCENT;

const getSystemPrefersDark = (): boolean =>
  Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

const getInitialThemePreference = (): ThemePreference => {
  // Business intent: default to dark to match the "agent chat" visual style; users can override via localStorage.
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage?.getItem(THEME_STORAGE_KEY) ?? '';
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'dark';
};

function App() {
  const t = useT();
  const locale = useLocale();

  const initialHash = typeof window === 'undefined' ? '' : String(window.location.hash ?? '');
  const lastHashRef = useRef<string>(initialHash);
  const [hash, setHash] = useState(() => initialHash);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getInitialThemePreference());

  const resolvedTheme: 'light' | 'dark' =
    themePreference === 'system' ? (getSystemPrefersDark() ? 'dark' : 'light') : themePreference;

  const route = useMemo(() => parseRoute(hash), [hash]);
  const accent = ACCENT;

  useEffect(() => {
    const onHashChange = () => {
      const nextHash = String(window.location.hash ?? '');
      const lastHash = String(lastHashRef.current ?? '');
      // Test/runtime safety:
      // - Some environments (incl. JSDOM) may dispatch `hashchange` automatically, while tests may dispatch it manually.
      // - Make the handler idempotent so duplicate events for the same hash do not corrupt the "prev hash" tracking.
      if (nextHash === lastHash) return;
      const source = consumeNextNavigationSource();

      // Navigation rule (migration parity with legacy frontend):
      // - For detail pages, the header back icon prefers the previous in-app location when it is safe.
      // - When navigation is triggered by the left sidebar (global menu), we intentionally "cut off" this back chain,
      //   so users don't jump back to an unrelated page after switching sections.
      setPrevHashForBack(source === 'sidebar' ? '' : lastHash);
      lastHashRef.current = nextHash;

      setHash(nextHash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Keep `<html data-theme>` in sync so CSS variables work in both light/dark modes.
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Keep `<html lang>` + `document.title` in sync with the current locale.
    document.documentElement.lang = locale;
    document.title = t('app.documentTitle');
  }, [locale, t]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Apply accent colors as CSS variables so custom CSS and Ant Design tokens stay consistent.
    document.documentElement.style.setProperty(ACCENT_VAR_PRIMARY, accent.primary);
    document.documentElement.style.setProperty(ACCENT_VAR_HOVER, accent.hover);
    document.documentElement.style.setProperty(ACCENT_VAR_ACTIVE, accent.active);
  }, [accent.active, accent.hover, accent.primary]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Persist theme preference (no UI yet; this keeps compatibility if other code writes the same key).
    window.localStorage?.setItem(THEME_STORAGE_KEY, themePreference);
  }, [themePreference]);

  return (
    <ConfigProvider
      locale={getAntdLocale(locale)}
      theme={{
        algorithm: resolvedTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          // Visual style (UI polish):
          // - Keep a slightly larger radius than AntD defaults to match the app's "soft surface" cards.
          // - Keep it here (instead of pure CSS) so built-in components (Modal/Input/Select) follow the same shape.
          borderRadius: 12,
          colorPrimary: accent.primary,
          colorInfo: accent.primary,
          colorLink: accent.primary,
          colorLinkHover: accent.hover,
          colorLinkActive: accent.active
        }
      }}
    >
      <AppShell
        route={route}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
      />
    </ConfigProvider>
  );
}

export default App;
