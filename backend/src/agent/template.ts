const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getByPath = (obj: unknown, path: string): unknown => {
  if (!path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const key of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
};

/**
 * Template rendering:
 * - Syntax: `{{path.to.value}}`
 * - Behavior: renders an empty string when the value is missing; non-strings are coerced via `String(value)`.
 */
export const renderTemplate = (template: string, context: Record<string, unknown>): string =>
  String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_raw, path: string) => {
    const value = getByPath(context, path);
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : String(value);
  });
