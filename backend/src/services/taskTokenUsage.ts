import type { TaskResult } from '../types/task';

export type TaskTokenUsage = NonNullable<TaskResult['tokenUsage']>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toNonNegativeInt = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const num = Math.floor(value);
  if (num < 0) return null;
  return num;
};

export const extractCodexExecTokenUsageDeltaFromLine = (
  line: string
): TaskTokenUsage | null => {
  const trimmed = String(line ?? '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return null;
    // Guardrail: Codex usage is emitted on `turn.completed`; avoid mis-attributing other providers' JSON logs.
    if (parsed.type !== 'turn.completed') return null;
    const usageRaw = parsed.usage;
    if (!isRecord(usageRaw)) return null;

    const input = toNonNegativeInt(usageRaw.input_tokens);
    const output = toNonNegativeInt(usageRaw.output_tokens);
    if (input === null && output === null) return null;

    const inputTokens = input ?? 0;
    const outputTokens = output ?? 0;
    if (inputTokens === 0 && outputTokens === 0) return null;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };
  } catch {
    return null;
  }
};

export const extractClaudeCodeExecTokenUsageDeltaFromLine = (
  line: string
): TaskTokenUsage | null => {
  const trimmed = String(line ?? '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return null;
    if (parsed.type !== 'result') return null;

    const usageRaw = parsed.usage;
    if (!isRecord(usageRaw)) return null;

    // Change record: Claude Code SDK uses Anthropic usage fields (`input_tokens`, `output_tokens`).
    const input = toNonNegativeInt(usageRaw.input_tokens);
    const output = toNonNegativeInt(usageRaw.output_tokens);
    if (input === null && output === null) return null;

    const inputTokens = input ?? 0;
    const outputTokens = output ?? 0;
    if (inputTokens === 0 && outputTokens === 0) return null;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };
  } catch {
    return null;
  }
};

export const extractGeminiCliExecTokenUsageDeltaFromLine = (
  line: string
): TaskTokenUsage | null => {
  const trimmed = String(line ?? '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return null;
    if (parsed.type !== 'result') return null;

    const statsRaw = parsed.stats;
    if (!isRecord(statsRaw)) return null;

    // Change record: Gemini CLI headless stream-json emits token counts under `stats`.
    const input = toNonNegativeInt(statsRaw.input_tokens);
    const output = toNonNegativeInt(statsRaw.output_tokens);
    if (input === null && output === null) return null;

    const inputTokens = input ?? 0;
    const outputTokens = output ?? 0;
    if (inputTokens === 0 && outputTokens === 0) return null;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };
  } catch {
    return null;
  }
};

export const extractCodexExecThreadIdFromLine = (line: string): string | null => {
  const trimmed = String(line ?? '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return null;
    if (parsed.type !== 'thread.started') return null;
    const threadId = typeof parsed.thread_id === 'string' ? parsed.thread_id.trim() : '';
    return threadId ? threadId : null;
  } catch {
    return null;
  }
};

export const extractClaudeCodeExecThreadIdFromLine = (line: string): string | null => {
  const trimmed = String(line ?? '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return null;
    if (parsed.type !== 'system' || parsed.subtype !== 'init') return null;
    const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id.trim() : '';
    return sessionId ? sessionId : null;
  } catch {
    return null;
  }
};

export const extractGeminiCliExecThreadIdFromLine = (line: string): string | null => {
  const trimmed = String(line ?? '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return null;
    if (parsed.type !== 'init') return null;
    const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id.trim() : '';
    return sessionId ? sessionId : null;
  } catch {
    return null;
  }
};

export const addTaskTokenUsage = (
  prev: TaskTokenUsage | undefined,
  delta: TaskTokenUsage
): TaskTokenUsage => {
  const prevInput = typeof prev?.inputTokens === 'number' && Number.isFinite(prev.inputTokens) ? prev.inputTokens : 0;
  const prevOutput = typeof prev?.outputTokens === 'number' && Number.isFinite(prev.outputTokens) ? prev.outputTokens : 0;

  const nextInput = prevInput + delta.inputTokens;
  const nextOutput = prevOutput + delta.outputTokens;

  return {
    inputTokens: nextInput,
    outputTokens: nextOutput,
    totalTokens: nextInput + nextOutput
  };
};
