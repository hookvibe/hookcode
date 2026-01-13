import type { TaskResult } from '../types/task';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const extractSummaryLines = (raw: string, maxLines: number): string | undefined => {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!text.trim()) return undefined;

  const lines: string[] = [];
  let start = 0;

  for (let i = 0; i <= text.length; i += 1) {
    if (i !== text.length && text.charCodeAt(i) !== 10) continue;
    const line = text.slice(start, i).trim();
    start = i + 1;
    if (!line) continue;
    lines.push(line);
    if (lines.length >= maxLines) break;
  }

  if (!lines.length) return undefined;
  return lines.join('\n');
};

const sanitizeResult = (
  result: unknown,
  options: { canViewLogs: boolean; includeOutputText: boolean }
): TaskResult | undefined => {
  if (!isRecord(result)) return undefined;

  const next: Record<string, unknown> = { ...result };

  if (!options.includeOutputText) {
    const hasSummary = typeof next.summary === 'string' && next.summary.trim();
    const outputText = typeof next.outputText === 'string' ? next.outputText : '';
    if (!hasSummary && outputText.trim()) {
      const derived = extractSummaryLines(outputText, 2);
      if (derived) next.summary = derived;
    }
  }

  if (!options.canViewLogs) {
    delete next.logs;
    delete next.logsSeq;
  }
  if (!options.includeOutputText) delete next.outputText;

  return next as TaskResult;
};

export const sanitizeTaskForViewer = <T extends { result?: unknown }>(
  task: T,
  options: { canViewLogs: boolean; includeOutputText: boolean }
): T => {
  const nextResult = sanitizeResult(task.result, options);
  if (!nextResult) return { ...task, result: undefined };
  return { ...task, result: nextResult };
};
