export interface TaskLogsSnapshot {
  logs: string[];
  seq: number;
}

const normalizeSeq = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number') return fallback;
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
};

export const extractTaskLogsSnapshot = (task: any): TaskLogsSnapshot => {
  const rawLogs = task?.result?.logs;
  const logs = Array.isArray(rawLogs) ? rawLogs.filter((v: unknown) => typeof v === 'string') : [];
  const seq = Math.max(logs.length, normalizeSeq(task?.result?.logsSeq, logs.length));
  return { logs, seq };
};

export const sliceLogsTail = (logs: string[], tail: number): string[] => {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  if (!Number.isFinite(tail) || tail <= 0) return logs;
  const n = Math.floor(tail);
  return n >= logs.length ? logs : logs.slice(logs.length - n);
};

export type TaskLogsDelta =
  | { type: 'noop'; nextSeenSeq: number }
  | { type: 'append'; nextSeenSeq: number; lines: string[] }
  | { type: 'resync'; nextSeenSeq: number; logs: string[] };

export const computeTaskLogsDelta = (params: { seenSeq: number; snapshot: TaskLogsSnapshot }): TaskLogsDelta => {
  const seenSeq = normalizeSeq(params.seenSeq, 0);
  const seq = normalizeSeq(params.snapshot?.seq, 0);
  const logs = Array.isArray(params.snapshot?.logs) ? params.snapshot.logs : [];

  if (seq < seenSeq) {
    // DB may lag behind in-memory streaming; do not rewind the cursor (avoid duplicate emits).
    // Only treat a full reset (seq=0 + empty logs) as a real reset signal.
    if (seq === 0 && logs.length === 0) {
      return { type: 'resync', nextSeenSeq: 0, logs: [] };
    }
    return { type: 'noop', nextSeenSeq: seenSeq };
  }

  if (seq === seenSeq) return { type: 'noop', nextSeenSeq: seenSeq };

  if (logs.length === 0) {
    return { type: 'resync', nextSeenSeq: seq, logs: [] };
  }

  const storedStartSeq = seq - logs.length + 1;
  const desiredStartSeq = seenSeq + 1;

  if (desiredStartSeq < storedStartSeq) {
    // We fell behind the rolling window and cannot replay the missing lines; re-sync with the latest snapshot.
    return { type: 'resync', nextSeenSeq: seq, logs };
  }

  const startIndex = desiredStartSeq - storedStartSeq;
  return { type: 'append', nextSeenSeq: seq, lines: logs.slice(startIndex) };
};

