// Extract task result parsing helpers for chat rendering. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { Task } from '../api';

// Shape parsed Codex structured outputs for result rendering + suggestions. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
export type StructuredTaskOutput = {
  output: string;
  nextActions: string[];
};

const parseStructuredTaskOutput = (raw: string): StructuredTaskOutput | null => {
  // Parse Codex structured outputs (output + next_actions) without breaking plain-text responses. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed) as any;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const output = typeof parsed.output === 'string' ? parsed.output.trim() : '';
    const nextActions = Array.isArray(parsed.next_actions)
      ? parsed.next_actions
          .filter((entry: unknown) => typeof entry === 'string' && entry.trim())
          .map((entry: string) => entry.trim())
          .slice(0, 3)
      : [];
    if (!output && nextActions.length === 0) return null;
    return { output, nextActions };
  } catch {
    return null;
  }
};

export const extractTaskResultText = (task?: Task | null): string => {
  const result = task?.result ?? {};
  const outputText = typeof (result as any)?.outputText === 'string' ? String((result as any).outputText).trim() : '';
  if (outputText) {
    const structured = parseStructuredTaskOutput(outputText);
    if (structured?.output) return structured.output;
    return outputText;
  }
  const summary = typeof (result as any)?.summary === 'string' ? String((result as any).summary).trim() : '';
  if (summary) return summary;
  const message = typeof (result as any)?.message === 'string' ? String((result as any).message).trim() : '';
  if (message) return message;
  const logs = Array.isArray((result as any)?.logs) ? (result as any).logs.filter((v: unknown) => typeof v === 'string') : [];
  if (logs.length) return logs.join('\n');
  return '';
};

export const extractTaskResultSuggestions = (task?: Task | null): string[] => {
  // Provide next-action suggestions from Codex structured output for chat UI affordances. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const result = task?.result ?? {};
  const outputText = typeof (result as any)?.outputText === 'string' ? String((result as any).outputText).trim() : '';
  if (!outputText) return [];
  const structured = parseStructuredTaskOutput(outputText);
  return structured?.nextActions ?? [];
};
