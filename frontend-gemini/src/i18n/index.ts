import { useCallback, useSyncExternalStore } from 'react';
import { zhCN, type MessageKey } from './messages/zh-CN';
import { enUS } from './messages/en-US';

/**
 * Minimal i18n store for the static chat demo.
 *
 * Business context:
 * - Module: Frontend Chat / i18n.
 * - Purpose: ensure all user-facing copy is translatable (zh-CN + en-US).
 *
 * Usage:
 * - React: `const t = useT(); t('some.key', { var: 'x' })`
 * - Switch locale: `setLocale('en-US')` (persisted to localStorage)
 *
 * Change record:
 * - 2026-01-11: Added a minimal, dependency-free i18n implementation aligned with the console UI.
 * - 2026-01-27: Removed legacy UI locale dependencies for the custom UI kit. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
 */

export type Locale = 'zh-CN' | 'en-US';

export const LOCALE_STORAGE_KEY = 'hookcode-locale';

export const supportedLocales: readonly Locale[] = ['zh-CN', 'en-US'] as const;

const normalizeLocale = (value: unknown): Locale | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return (supportedLocales as readonly string[]).includes(normalized) ? (normalized as Locale) : null;
};

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const loadInitialLocale = (): Locale => {
  // Business intent: default to Simplified Chinese for this demo package.
  if (!canUseStorage()) return 'zh-CN';
  const stored = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  return stored ?? 'zh-CN';
};

let currentLocale: Locale = loadInitialLocale();
const listeners = new Set<() => void>();

export const getLocale = (): Locale => currentLocale;

export const setLocale = (locale: Locale) => {
  if (locale === currentLocale) return;
  currentLocale = locale;
  if (canUseStorage()) {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
};

export const subscribeLocale = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

type Messages = Record<MessageKey, string>;

const messagesByLocale: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  'en-US': enUS
};

const format = (template: string, vars?: Record<string, unknown>): string => {
  if (!vars) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_raw, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
};

export const translate = (locale: Locale, key: MessageKey, vars?: Record<string, unknown>): string => {
  const dict = messagesByLocale[locale] ?? zhCN;
  const template = dict[key] ?? zhCN[key] ?? String(key);
  return format(template, vars);
};

export type TFunction = (key: MessageKey, vars?: Record<string, unknown>) => string;

export const useLocale = (): Locale => useSyncExternalStore(subscribeLocale, getLocale, getLocale);

export const useT = (): TFunction => {
  const locale = useLocale();
  return useCallback((key: MessageKey, vars?: Record<string, unknown>) => translate(locale, key, vars), [locale]);
};

export type { MessageKey };
