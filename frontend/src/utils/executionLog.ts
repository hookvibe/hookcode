export type ExecutionItemStatus = 'in_progress' | 'completed' | 'failed' | (string & {});

export type ExecutionFileChangeKind = 'create' | 'update' | 'delete' | (string & {});

export type ExecutionFileChange = {
  path: string;
  kind?: ExecutionFileChangeKind;
};

export type ExecutionFileDiff = {
  path: string;
  kind?: ExecutionFileChangeKind;
  unifiedDiff: string;
  oldText?: string;
  newText?: string;
};

export type ExecutionItem =
  | {
      kind: 'command_execution';
      id: string;
      status: ExecutionItemStatus;
      command: string;
      exitCode?: number | null;
      output?: string;
    }
  | {
      kind: 'file_change';
      id: string;
      status: ExecutionItemStatus;
      changes: ExecutionFileChange[];
      diffs: ExecutionFileDiff[];
    }
  | {
      kind: 'agent_message';
      id: string;
      status: ExecutionItemStatus;
      text: string;
    }
  | {
      kind: 'reasoning';
      id: string;
      status: ExecutionItemStatus;
      text: string;
    }
  | {
      kind: 'unknown';
      id: string;
      status: ExecutionItemStatus;
      itemType: string;
      raw: unknown;
    };

export type ExecutionTimelineState = {
  items: ExecutionItem[];
  itemsById: Record<string, number>;
  parsedCount: number;
};

export const createEmptyTimeline = (): ExecutionTimelineState => ({ items: [], itemsById: {}, parsedCount: 0 });

type ParsedLine =
  | { kind: 'item'; item: ExecutionItem }
  | { kind: 'file_diff'; itemId: string; diff: ExecutionFileDiff }
  | { kind: 'ignore' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asNumberOrNull = (value: unknown): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

// Support Claude Code JSONL summarization without breaking existing Codex parsing. docs/en/developer/plans/claudecode-log-display20260123/task_plan.md claudecode-log-display20260123
const toInlineText = (value: unknown, maxLen: number): string => {
  const raw = typeof value === 'string'
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

const toRawText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value, null, 2);
    return typeof json === 'string' ? json : '';
  } catch (err) {
    return String(err);
  }
};

const summarizeToolInput = (input: unknown): string => {
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

const buildToolCommand = (name: string, input: unknown): string => {
  const toolName = name.trim();
  const summary = summarizeToolInput(input);
  if (toolName && summary) return `${toolName} ${summary}`;
  return toolName || summary || '-';
};

// Normalize Claude Code SDK message payloads into ExecutionItem records for the timeline view. docs/en/developer/plans/claudecode-log-display20260123/task_plan.md claudecode-log-display20260123
const buildClaudeMessageItems = (payload: Record<string, unknown>): ExecutionItem[] => {
  const message = isRecord(payload.message) ? payload.message : null;
  if (!message) return [];
  const messageId = asString(message.id).trim() || asString(payload.uuid).trim();
  const role = asString(message.role).trim();
  const content = asArray(message.content);

  return content
    .map((entry, index) => {
      if (!isRecord(entry)) return null;
      const entryType = asString(entry.type).trim();
      if (!entryType) return null;

      if (entryType === 'text') {
        const text = asString(entry.text);
        if (!text) return null;
        return {
          kind: 'agent_message',
          id: `${messageId || role || 'message'}_${index}`,
          status: 'completed',
          text
        } satisfies ExecutionItem;
      }

      if (entryType === 'tool_use') {
        const toolId = asString(entry.id).trim() || `${messageId || role || 'message'}_tool_${index}`;
        const command = buildToolCommand(asString(entry.name), entry.input);
        return {
          kind: 'command_execution',
          id: toolId,
          status: 'in_progress',
          command,
          output: undefined,
          exitCode: undefined
        } satisfies ExecutionItem;
      }

      if (entryType === 'tool_result') {
        const toolUseId = asString(entry.tool_use_id).trim();
        const output = toRawText(entry.content);
        const isError = entry.is_error === true;
        return {
          kind: 'command_execution',
          id: toolUseId || `${messageId || role || 'message'}_tool_result_${index}`,
          status: isError ? 'failed' : 'completed',
          command: '',
          output: output || undefined,
          exitCode: undefined
        } satisfies ExecutionItem;
      }

      return null;
    })
    .filter((item): item is ExecutionItem => Boolean(item));
};

const buildClaudeSystemItem = (payload: Record<string, unknown>): ExecutionItem | null => {
  const subtype = asString(payload.subtype).trim();
  const model = asString(payload.model).trim();
  const version = asString(payload.claude_code_version).trim();
  const cwd = asString(payload.cwd).trim();
  const tools = asArray(payload.tools).map((tool) => asString(tool)).filter(Boolean);
  const parts = ['Claude Code system'];

  if (subtype) parts.push(`subtype=${subtype}`);
  if (model) parts.push(`model=${model}`);
  if (version) parts.push(`version=${version}`);
  if (cwd) parts.push(`cwd=${cwd}`);
  if (tools.length) parts.push(`tools=${tools.join(', ')}`);

  return {
    kind: 'agent_message',
    id: `system_${subtype || 'message'}_${asString(payload.uuid).trim() || asString(payload.session_id).trim() || 'system'}`,
    status: 'completed',
    text: parts.join(' | ')
  };
};

const buildClaudeResultItem = (payload: Record<string, unknown>): ExecutionItem | null => {
  const subtype = asString(payload.subtype).trim();
  const resultText = asString(payload.result);
  const errors = Array.isArray(payload.errors) ? payload.errors.map((err) => String(err)) : [];
  const failed = Boolean(payload.is_error) || (subtype && subtype !== 'success') || errors.length > 0;
  const text = resultText || errors.join('\n') || toInlineText(payload, 500);

  if (!text) return null;
  return {
    kind: 'agent_message',
    id: `result_${asString(payload.uuid).trim() || asString(payload.session_id).trim() || 'result'}`,
    status: failed ? 'failed' : 'completed',
    text
  };
};

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

  return [{ kind: 'item', item: { kind: 'unknown', id: itemId, status, itemType, raw: itemRaw } }];
};

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
