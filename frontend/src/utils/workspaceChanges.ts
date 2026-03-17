import type { TaskWorkspaceChanges } from '../api';

const WORKSPACE_SNAPSHOT_EVENT_TYPE = 'hookcode.workspace.snapshot';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const parseWorkspaceSnapshotLogLine = (line: string): TaskWorkspaceChanges | null | undefined => {
  const raw = String(line ?? '').trim();
  if (!raw.startsWith('{') || !raw.endsWith('}')) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || parsed.type !== WORKSPACE_SNAPSHOT_EVENT_TYPE) return undefined;
  const snapshot = parsed.snapshot;
  if (snapshot === null) return null;
  if (!isRecord(snapshot)) return undefined;

  const files = Array.isArray(snapshot.files) ? snapshot.files.filter((entry) => isRecord(entry)) : [];
  return {
    // Parse worker-emitted workspace snapshot logs so TaskLogViewer can update file diff panels without a task-detail refetch. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    capturedAt: typeof snapshot.capturedAt === 'string' ? snapshot.capturedAt : '',
    files: files.map((entry) => ({
      path: typeof entry.path === 'string' ? entry.path : '',
      kind: typeof entry.kind === 'string' ? entry.kind : undefined,
      unifiedDiff: typeof entry.unifiedDiff === 'string' ? entry.unifiedDiff : '',
      oldText: typeof entry.oldText === 'string' ? entry.oldText : undefined,
      newText: typeof entry.newText === 'string' ? entry.newText : undefined,
      diffHash: typeof entry.diffHash === 'string' ? entry.diffHash : '',
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : ''
    }))
  };
};

export const extractLatestWorkspaceChangesFromLogs = (lines: string[]): TaskWorkspaceChanges | null | undefined => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = parseWorkspaceSnapshotLogLine(lines[index] ?? '');
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};
