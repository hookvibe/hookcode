import { Injectable } from '@nestjs/common';
import type { PreviewLogEntry } from './preview.types';

export interface PreviewLogStreamEvent {
  entry: PreviewLogEntry;
}

type PreviewLogListener = (event: PreviewLogStreamEvent) => void;

@Injectable()
export class PreviewLogStream {
  private readonly listenersByInstanceKey = new Map<string, Set<PreviewLogListener>>();

  static buildInstanceKey(taskGroupId: string, instanceName: string): string {
    // Centralize preview instance log keys for SSE subscriptions. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    return `${taskGroupId}:${instanceName}`;
  }

  publish(instanceKey: string, entry: PreviewLogEntry): void {
    // Broadcast preview log entries to SSE subscribers keyed by instance. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const listeners = this.listenersByInstanceKey.get(instanceKey);
    if (!listeners || listeners.size === 0) return;

    const event: PreviewLogStreamEvent = { entry };
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[previewLogStream] listener failed', err);
      }
    });
  }

  subscribe(instanceKey: string, listener: PreviewLogListener): () => void {
    // Register SSE consumers for preview log streaming. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const set = this.listenersByInstanceKey.get(instanceKey) ?? new Set<PreviewLogListener>();
    set.add(listener);
    this.listenersByInstanceKey.set(instanceKey, set);

    return () => {
      const current = this.listenersByInstanceKey.get(instanceKey);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listenersByInstanceKey.delete(instanceKey);
    };
  }
}
