// Extract execution log parsing helpers for reuse across parsers. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const asNumberOrNull = (value: unknown): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

// Support Claude Code JSONL summarization without breaking existing Codex parsing. docs/en/developer/plans/claudecode-log-display20260123/task_plan.md claudecode-log-display20260123
export const toInlineText = (value: unknown, maxLen: number): string => {
  const raw =
    typeof value === 'string'
      ? value
      : (() => {
          try {
            const json = JSON.stringify(value);
            return typeof json === 'string' ? json : '';
          } catch (err) {
            return String(err);
          }
        })();
  const singleLine = raw.replace(/\s+/g, ' ').trim();
  if (!singleLine) return '';
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, Math.max(0, maxLen - 1))}…`;
};

export const toRawText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value, null, 2);
    return typeof json === 'string' ? json : '';
  } catch (err) {
    return String(err);
  }
};

export const summarizeToolInput = (input: unknown): string => {
  if (!isRecord(input)) return '';
  const parts: string[] = [];
  const maybeAdd = (label: string, value: unknown) => {
    const text = toInlineText(value, 120);
    if (text) parts.push(`${label}=${text}`);
  };

  if (typeof input.file_path === 'string') maybeAdd('file_path', input.file_path);
  if (typeof input.path === 'string') maybeAdd('path', input.path);
  if (typeof input.pattern === 'string') maybeAdd('pattern', input.pattern);
  if (typeof input.command === 'string') maybeAdd('command', input.command);
  if (typeof input.query === 'string') maybeAdd('query', input.query);
  if (typeof input.cwd === 'string') maybeAdd('cwd', input.cwd);

  if (typeof input.content === 'string') parts.push(`content=${input.content.length} chars`);
  if (typeof input.patch === 'string') parts.push(`patch=${input.patch.length} chars`);

  if (parts.length) return parts.join(', ');
  return toInlineText(input, 140);
};

export const buildToolCommand = (name: string, input: unknown): string => {
  const toolName = name.trim();
  const summary = summarizeToolInput(input);
  if (toolName && summary) return `${toolName} ${summary}`;
  return toolName || summary || '-';
};
