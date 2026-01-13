export type AdminToolsLocale = 'zh-CN' | 'en-US';

export const DEFAULT_ADMIN_TOOLS_LOCALE: AdminToolsLocale = 'zh-CN';

const normalizeLocaleString = (raw: string): AdminToolsLocale | null => {
  const value = raw.trim().replace(/_/g, '-').toLowerCase();
  if (!value) return null;

  if (value === 'cn') return 'zh-CN';
  if (value === 'zh' || value.startsWith('zh-')) return 'zh-CN';
  if (value === 'en' || value.startsWith('en-')) return 'en-US';

  return null;
};

export const resolveAdminToolsLocale = (params: {
  queryLang?: unknown;
  acceptLanguage?: unknown;
  fallback?: AdminToolsLocale;
}): AdminToolsLocale => {
  const fallback = params.fallback ?? DEFAULT_ADMIN_TOOLS_LOCALE;

  const fromQuery =
    typeof params.queryLang === 'string'
      ? normalizeLocaleString(params.queryLang)
      : Array.isArray(params.queryLang) && typeof params.queryLang[0] === 'string'
        ? normalizeLocaleString(params.queryLang[0])
        : null;
  if (fromQuery) return fromQuery;

  const header = typeof params.acceptLanguage === 'string' ? params.acceptLanguage : '';
  if (header) {
    const tokens = header
      .split(',')
      .map((part) => part.split(';')[0]?.trim())
      .filter(Boolean) as string[];
    for (const token of tokens) {
      const normalized = normalizeLocaleString(token);
      if (normalized) return normalized;
    }
  }

  return fallback;
};

