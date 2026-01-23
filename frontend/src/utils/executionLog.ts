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

const asNumberOrNull = (value: unknown): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

/**
 * Parse a single task log line into an execution UI event. yjlphd6rbkrq521ny796
 */
export const parseExecutionLogLine = (line: string): ParsedLine => {
  const raw = String(line ?? '');
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return { kind: 'ignore' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { kind: 'ignore' };
  }

  if (!isRecord(parsed)) return { kind: 'ignore' };
  const type = asString(parsed.type).trim();
  if (!type) return { kind: 'ignore' };

  if (type === 'hookcode.file.diff') {
    const itemId = asString(parsed.item_id).trim();
    const p = asString(parsed.path).trim();
    const unified = asString(parsed.unified_diff);
    if (!itemId || !p || !unified) return { kind: 'ignore' };

    return {
      kind: 'file_diff',
      itemId,
      diff: {
        path: p,
        kind: asString(parsed.kind).trim() as ExecutionFileChangeKind,
        unifiedDiff: unified,
        oldText: typeof parsed.old_text === 'string' ? parsed.old_text : undefined,
        newText: typeof parsed.new_text === 'string' ? parsed.new_text : undefined
      }
    };
  }

  if (type !== 'item.started' && type !== 'item.updated' && type !== 'item.completed') return { kind: 'ignore' };
  const itemRaw = (parsed as any).item;
  if (!isRecord(itemRaw)) return { kind: 'ignore' };

  const itemId = asString(itemRaw.id).trim();
  const itemType = asString(itemRaw.type).trim();
  const status = (asString(itemRaw.status).trim() || type.replace('item.', '')) as ExecutionItemStatus;
  if (!itemId || !itemType) return { kind: 'ignore' };

  if (itemType === 'command_execution') {
    const command = asString(itemRaw.command);
    const output = typeof itemRaw.aggregated_output === 'string' ? itemRaw.aggregated_output : undefined;
    const exitCode = asNumberOrNull(itemRaw.exit_code);
    return {
      kind: 'item',
      item: { kind: 'command_execution', id: itemId, status, command, output, exitCode }
    };
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
    return {
      kind: 'item',
      item: { kind: 'file_change', id: itemId, status, changes, diffs: [] }
    };
  }

  if (itemType === 'agent_message') {
    const text = asString(itemRaw.text);
    return { kind: 'item', item: { kind: 'agent_message', id: itemId, status, text } };
  }

  if (itemType === 'reasoning') {
    const text = asString(itemRaw.text);
    return { kind: 'item', item: { kind: 'reasoning', id: itemId, status, text } };
  }

  return { kind: 'item', item: { kind: 'unknown', id: itemId, status, itemType, raw: itemRaw } };
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
  if (parsed.kind === 'ignore') return state;
  if (parsed.kind === 'item') return upsertItem(state, parsed.item);
  if (parsed.kind === 'file_diff') return attachDiff(state, parsed.itemId, parsed.diff);
  return state;
};

