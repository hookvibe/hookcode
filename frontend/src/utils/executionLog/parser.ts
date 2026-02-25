// Extract execution log line parsing into a dedicated module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { ExecutionFileChange, ExecutionFileChangeKind, ExecutionFileDiff, ExecutionItem, ExecutionItemStatus, ExecutionTodoItem, ParsedLine } from './types';
import { asArray, asNumberOrNull, asString, isRecord, toInlineText } from './helpers';
import { buildClaudeMessageItems, buildClaudeResultItem, buildClaudeSystemItem } from './claude';

/**
 * Parse a single task log line into an execution UI event. yjlphd6rbkrq521ny796
 */
export const parseExecutionLogLine = (line: string): ParsedLine[] => {
  const raw = String(line ?? '');
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return [];
  }

  if (!isRecord(parsed)) return [];
  const type = asString(parsed.type).trim();
  if (!type) return [];

  if (type === 'hookcode.file.diff') {
    const itemId = asString(parsed.item_id).trim();
    const p = asString(parsed.path).trim();
    const unified = asString(parsed.unified_diff);
    if (!itemId || !p || !unified) return [];

    return [
      {
        kind: 'file_diff',
        itemId,
        diff: {
          path: p,
          kind: asString(parsed.kind).trim() as ExecutionFileChangeKind,
          unifiedDiff: unified,
          oldText: typeof parsed.old_text === 'string' ? parsed.old_text : undefined,
          newText: typeof parsed.new_text === 'string' ? parsed.new_text : undefined
        }
      }
    ];
  }

  if (type === 'assistant' || type === 'user') {
    // Map Claude Code message content to execution items for structured timeline rendering. docs/en/developer/plans/claudecode-log-display20260123/task_plan.md claudecode-log-display20260123
    return buildClaudeMessageItems(parsed).map((item) => ({ kind: 'item', item }));
  }

  if (type === 'system') {
    const systemItem = buildClaudeSystemItem(parsed);
    return systemItem ? [{ kind: 'item', item: systemItem }] : [];
  }

  if (type === 'result') {
    const resultItem = buildClaudeResultItem(parsed);
    return resultItem ? [{ kind: 'item', item: resultItem }] : [];
  }

  if (type === 'auth_status') {
    return [
      {
        kind: 'item',
        item: {
          kind: 'agent_message',
          id: `auth_${asString(parsed.uuid).trim() || asString(parsed.session_id).trim() || 'status'}`,
          status: 'completed',
          text: `Auth status: ${toInlineText(parsed, 240)}`
        }
      }
    ];
  }

  if (type !== 'item.started' && type !== 'item.updated' && type !== 'item.completed') return [];
  const itemRaw = (parsed as any).item;
  if (!isRecord(itemRaw)) return [];

  const itemId = asString(itemRaw.id).trim();
  const itemType = asString(itemRaw.type).trim();
  const status = (asString(itemRaw.status).trim() || type.replace('item.', '')) as ExecutionItemStatus;
  if (!itemId || !itemType) return [];

  if (itemType === 'command_execution') {
    const command = asString(itemRaw.command);
    const output = typeof itemRaw.aggregated_output === 'string' ? itemRaw.aggregated_output : undefined;
    const exitCode = asNumberOrNull(itemRaw.exit_code);
    return [{ kind: 'item', item: { kind: 'command_execution', id: itemId, status, command, output, exitCode } }];
  }

  if (itemType === 'file_change') {
    const changes: ExecutionFileChange[] = Array.isArray(itemRaw.changes)
      ? itemRaw.changes
          .map((entry: unknown) => {
            if (!isRecord(entry)) return null;
            const p = asString(entry.path).trim();
            if (!p) return null;
            const kind = asString(entry.kind).trim() as ExecutionFileChangeKind;
            return { path: p, kind: kind || undefined };
          })
          .filter((v): v is ExecutionFileChange => Boolean(v))
      : [];
    return [{ kind: 'item', item: { kind: 'file_change', id: itemId, status, changes, diffs: [] } }];
  }

  if (itemType === 'agent_message') {
    const text = asString(itemRaw.text);
    return [{ kind: 'item', item: { kind: 'agent_message', id: itemId, status, text } }];
  }

  if (itemType === 'reasoning') {
    const text = asString(itemRaw.text);
    return [{ kind: 'item', item: { kind: 'reasoning', id: itemId, status, text } }];
  }

  if (itemType === 'todo_list') {
    // Capture todo_list payloads as structured items for the timeline. docs/en/developer/plans/todoeventlog20260123/task_plan.md todoeventlog20260123
    const items: ExecutionTodoItem[] = Array.isArray(itemRaw.items)
      ? itemRaw.items
          .map((entry: unknown) => {
            if (!isRecord(entry)) return null;
            const text = asString(entry.text).trim();
            if (!text) return null;
            return { text, completed: entry.completed === true };
          })
          .filter((entry): entry is ExecutionTodoItem => Boolean(entry))
      : [];
    return [{ kind: 'item', item: { kind: 'todo_list', id: itemId, status, items } }];
  }

  return [{ kind: 'item', item: { kind: 'unknown', id: itemId, status, itemType, raw: itemRaw } }];
};
