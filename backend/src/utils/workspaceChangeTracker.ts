import type { TaskWorkspaceChanges } from '../types/task';
import {
  collectWorkspaceChanges,
  createWorkspaceSnapshotLogLine,
  filterWorkspaceChangesAgainstBaseline
} from './workspaceChanges';

type TrackerStatus = 'in_progress' | 'completed' | 'failed';

const defaultItemId = (taskId: string): string => `workspace_changes_${taskId}`;

export class WorkspaceChangeTracker {
  private readonly itemId: string;
  private readonly pollIntervalMs: number;
  private readonly emitTimelineEvents: boolean;
  private timer: NodeJS.Timeout | null = null;
  private baseline: TaskWorkspaceChanges | null = null;
  private lastSnapshot: TaskWorkspaceChanges | null | undefined = undefined;
  private lastFileHashes = new Map<string, string>();
  private timelineStarted = false;
  private pollPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly params: {
      taskId: string;
      repoDir: string;
      emitLine?: (line: string) => Promise<void>;
      persistSnapshot?: (snapshot: TaskWorkspaceChanges | null) => Promise<void>;
      emitTimelineEvents?: boolean;
      itemId?: string;
      pollIntervalMs?: number;
    }
  ) {
    this.itemId = params.itemId ?? defaultItemId(params.taskId);
    this.pollIntervalMs = params.pollIntervalMs ?? 1200;
    this.emitTimelineEvents = params.emitTimelineEvents !== false;
  }

  async start(): Promise<void> {
    // Capture a baseline snapshot before provider execution so reused workspaces only report changes from the current task run. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    this.baseline = await collectWorkspaceChanges(this.params.repoDir);
    this.lastSnapshot = filterWorkspaceChangesAgainstBaseline(this.baseline, this.baseline);
    this.timer = setInterval(() => {
      void this.sync({ status: 'in_progress' });
    }, this.pollIntervalMs);
  }

  async stop(status: 'completed' | 'failed'): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.sync({ status });
  }

  private async sync(options: { status: TrackerStatus }): Promise<void> {
    this.pollPromise = this.pollPromise.then(async () => {
      const rawSnapshot = await collectWorkspaceChanges(this.params.repoDir);
      const snapshot = filterWorkspaceChangesAgainstBaseline(rawSnapshot, this.baseline);
      const changed = this.hasSnapshotChanged(snapshot);
      const isTerminal = options.status !== 'in_progress';

      if (changed) {
        this.lastSnapshot = snapshot;
        await this.params.persistSnapshot?.(snapshot);
        await this.params.emitLine?.(createWorkspaceSnapshotLogLine(snapshot));
      }

      if (!this.emitTimelineEvents) return;
      if (snapshot?.files.length) {
        await this.emitTimelineSnapshot(snapshot, isTerminal ? 'completed' : 'in_progress', changed);
        return;
      }

      if (this.timelineStarted && isTerminal) {
        await this.params.emitLine?.(
          JSON.stringify({
            type: 'item.completed',
            item: {
              id: this.itemId,
              type: 'file_change',
              status: 'completed',
              changes: []
            }
          })
        );
      }
    }).catch(() => undefined);

    await this.pollPromise;
  }

  private hasSnapshotChanged(nextSnapshot: TaskWorkspaceChanges | null): boolean {
    if (this.lastSnapshot === undefined) return true;
    const prevFiles = this.lastSnapshot?.files ?? [];
    const nextFiles = nextSnapshot?.files ?? [];
    if (prevFiles.length !== nextFiles.length) return true;
    for (let index = 0; index < nextFiles.length; index += 1) {
      const prev = prevFiles[index];
      const next = nextFiles[index];
      if (!prev || prev.path !== next.path || prev.diffHash !== next.diffHash || prev.kind !== next.kind) {
        return true;
      }
    }
    return false;
  }

  private async emitTimelineSnapshot(snapshot: TaskWorkspaceChanges, status: TrackerStatus, changed: boolean): Promise<void> {
    const payload = {
      item: {
        id: this.itemId,
        type: 'file_change',
        status,
        changes: snapshot.files.map((file) => ({ path: file.path, kind: file.kind }))
      }
    };

    if (!this.timelineStarted) {
      this.timelineStarted = true;
      await this.params.emitLine?.(JSON.stringify({ type: 'item.started', ...payload }));
    } else if (changed) {
      await this.params.emitLine?.(JSON.stringify({ type: status === 'completed' ? 'item.completed' : 'item.updated', ...payload }));
    } else if (status === 'completed') {
      await this.params.emitLine?.(JSON.stringify({ type: 'item.completed', ...payload }));
    }

    for (const file of snapshot.files) {
      if (this.lastFileHashes.get(file.path) === file.diffHash && status !== 'completed') continue;
      this.lastFileHashes.set(file.path, file.diffHash);
      await this.params.emitLine?.(
        JSON.stringify({
          type: 'hookcode.file.diff',
          item_id: this.itemId,
          path: file.path,
          kind: file.kind,
          unified_diff: file.unifiedDiff,
          old_text: file.oldText,
          new_text: file.newText
        })
      );
    }
  }
}
