import { BackendInternalApiClient } from '../backend/internalApiClient';

interface PendingLogEntry {
  seq: number;
  line: string;
}

export class TaskLogBatcher {
  private readonly pending: PendingLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushPromise: Promise<void> | null = null;
  private flushError: Error | null = null;

  constructor(
    private readonly client: BackendInternalApiClient,
    private readonly taskId: string,
    private readonly flushIntervalMs = 300,
    private readonly batchSize = 20
  ) {}

  add(seq: number, line: string): void {
    // Batch worker log writes so remote execution keeps SSE reasonably live without issuing one HTTP write per line. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    this.pending.push({ seq, line });
    if (this.pending.length >= this.batchSize) {
      this.scheduleImmediateFlush();
      return;
    }
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.scheduleImmediateFlush(), this.flushIntervalMs);
    }
  }

  private scheduleImmediateFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.flushPromise) {
      this.flushPromise = this.flush().finally(() => {
        this.flushPromise = null;
      });
    }
  }

  private async flush(): Promise<void> {
    if (!this.pending.length) return;
    try {
      this.pending.sort((left, right) => left.seq - right.seq);
      while (this.pending.length > 0) {
        const first = this.pending.shift();
        if (!first) return;
        const lines = [first.line];
        let previousSeq = first.seq;
        while (this.pending.length > 0 && this.pending[0]?.seq === previousSeq + 1) {
          const entry = this.pending.shift();
          if (!entry) break;
          lines.push(entry.line);
          previousSeq = entry.seq;
        }
        await this.client.appendLogs(this.taskId, first.seq - 1, lines);
      }
    } catch (error) {
      this.flushError = error instanceof Error ? error : new Error(String(error));
      throw this.flushError;
    }
  }

  async close(): Promise<void> {
    this.scheduleImmediateFlush();
    await this.flushPromise;
    if (this.flushError) {
      throw this.flushError;
    }
  }
}
