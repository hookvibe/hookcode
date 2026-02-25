// Extract execution log timeline reducers into a focused module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { ExecutionFileDiff, ExecutionItem, ExecutionTimelineState } from './types';
import { parseExecutionLogLine } from './parser';

export const createEmptyTimeline = (): ExecutionTimelineState => ({ items: [], itemsById: {}, parsedCount: 0 });

const upsertItem = (state: ExecutionTimelineState, next: ExecutionItem): ExecutionTimelineState => {
  const idx = state.itemsById[next.id];
  if (typeof idx === 'number') {
    const existing = state.items[idx];
    const merged = mergeItems(existing, next);
    if (merged === existing) return state;
    const items = state.items.slice();
    items[idx] = merged;
    return { ...state, items };
  }

  return {
    items: [...state.items, next],
    itemsById: { ...state.itemsById, [next.id]: state.items.length },
    parsedCount: state.parsedCount + 1
  };
};

const mergeItems = (prev: ExecutionItem, next: ExecutionItem): ExecutionItem => {
  if (prev.kind !== next.kind) return next;

  if (next.kind === 'command_execution') {
    const n = next;
    const p = prev as Extract<ExecutionItem, { kind: 'command_execution' }>;
    return {
      ...p,
      status: n.status || p.status,
      command: n.command || p.command,
      output: n.output !== undefined ? n.output : p.output,
      exitCode: n.exitCode !== undefined ? n.exitCode : p.exitCode
    };
  }

  if (next.kind === 'file_change') {
    const n = next;
    const p = prev as Extract<ExecutionItem, { kind: 'file_change' }>;
    return {
      ...p,
      status: n.status || p.status,
      changes: n.changes?.length ? n.changes : p.changes,
      diffs: p.diffs
    };
  }

  if (next.kind === 'agent_message') {
    const n = next;
    const p = prev as Extract<ExecutionItem, { kind: 'agent_message' }>;
    return { ...p, status: n.status || p.status, text: n.text || p.text };
  }

  if (next.kind === 'reasoning') {
    const n = next;
    const p = prev as Extract<ExecutionItem, { kind: 'reasoning' }>;
    return { ...p, status: n.status || p.status, text: n.text || p.text };
  }

  if (next.kind === 'todo_list') {
    // Merge todo_list updates by preferring the latest items payload. docs/en/developer/plans/todoeventlog20260123/task_plan.md todoeventlog20260123
    const n = next;
    const p = prev as Extract<ExecutionItem, { kind: 'todo_list' }>;
    return { ...p, status: n.status || p.status, items: n.items?.length ? n.items : p.items };
  }

  return next;
};

const attachDiff = (state: ExecutionTimelineState, itemId: string, diff: ExecutionFileDiff): ExecutionTimelineState => {
  const idx = state.itemsById[itemId];
  if (typeof idx !== 'number') {
    const placeholder: ExecutionItem = { kind: 'file_change', id: itemId, status: 'completed', changes: [], diffs: [diff] };
    return {
      items: [...state.items, placeholder],
      itemsById: { ...state.itemsById, [itemId]: state.items.length },
      parsedCount: state.parsedCount + 1
    };
  }

  const existing = state.items[idx];
  if (existing.kind !== 'file_change') return state;

  const currentDiffs = existing.diffs ?? [];
  const nextDiffs = currentDiffs.slice();
  const pos = nextDiffs.findIndex((d) => d.path === diff.path);
  if (pos >= 0) nextDiffs[pos] = diff;
  else nextDiffs.push(diff);

  const items = state.items.slice();
  items[idx] = { ...existing, diffs: nextDiffs };
  return { ...state, items };
};

export const buildExecutionTimeline = (lines: string[]): ExecutionTimelineState => {
  let state = createEmptyTimeline();
  for (const line of lines) {
    state = applyExecutionLogLine(state, line);
  }
  return state;
};

export const applyExecutionLogLine = (state: ExecutionTimelineState, line: string): ExecutionTimelineState => {
  const parsed = parseExecutionLogLine(line);
  let next = state;
  // Apply multiple parsed entries in order to preserve Claude Code content sequencing. docs/en/developer/plans/claudecode-log-display20260123/task_plan.md claudecode-log-display20260123
  for (const entry of parsed) {
    if (entry.kind === 'item') next = upsertItem(next, entry.item);
    if (entry.kind === 'file_diff') next = attachDiff(next, entry.itemId, entry.diff);
  }
  return next;
};
