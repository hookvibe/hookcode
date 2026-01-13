/**
 * Process-local pub/sub for task logs:
 * - Producer: `backend/src/agent/agent.ts` continuously calls `publish(taskId, line)` while executing a task.
 * - Consumer: the SSE endpoint in `backend/src/routes/tasks.ts` calls `subscribe()` and pushes to the frontend (`frontend/src/components/TaskLogViewer.tsx`).
 *
 * Note: this is in-memory and cannot be shared across processes/containers; therefore tasks SSE also has a DB polling fallback (see `backend/src/routes/tasks.ts`).
 */
import { Injectable } from '@nestjs/common';

export interface TaskLogStreamEvent {
  line: string;
}

type LogListener = (event: TaskLogStreamEvent) => void;

@Injectable()
export class TaskLogStream {
  private readonly listenersByTaskId = new Map<string, Set<LogListener>>();

  publish(taskId: string, line: string) {
    const listeners = this.listenersByTaskId.get(taskId);
    if (!listeners || listeners.size === 0) return;

    const event: TaskLogStreamEvent = { line };
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[taskLogStream] listener failed', err);
      }
    });
  }

  subscribe(taskId: string, listener: LogListener): () => void {
    const set = this.listenersByTaskId.get(taskId) ?? new Set<LogListener>();
    set.add(listener);
    this.listenersByTaskId.set(taskId, set);

    return () => {
      const current = this.listenersByTaskId.get(taskId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listenersByTaskId.delete(taskId);
    };
  }
}

