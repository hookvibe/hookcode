/**
 * Provider runtime helpers (shared by model providers).
 *
 * Business context:
 * - HookCode streams model/agent runtime events into task logs so users can debug executions in the console UI.
 * - Providers must never be blocked by DB/log persistence failures; logging is best-effort.
 *
 * Change record:
 * - 2026-01: extracted from the Codex provider to reuse for additional providers (e.g., Claude Code).
 */

type AsyncLogItem = { line: string; important: boolean };

export const createAsyncLineLogger = (params: {
  logLine?: (line: string) => Promise<void>;
  redact?: (text: string) => string;
  maxQueueSize?: number;
}) => {
  const maxQueueSize = typeof params.maxQueueSize === 'number' && params.maxQueueSize > 0 ? params.maxQueueSize : 200;
  const queue: AsyncLogItem[] = [];
  let pumpPromise: Promise<void> | null = null;

  const pump = async () => {
    if (!params.logLine) return;

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        await params.logLine(item.line);
      } catch (err) {
        // Best-effort: never block provider execution on log persistence.
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[providerRuntime] logLine failed (ignored)', { error: err });
        }
      }
    }
  };

  const ensurePump = () => {
    if (!params.logLine) return;
    if (pumpPromise) return;
    pumpPromise = pump().finally(() => {
      pumpPromise = null;
      if (queue.length > 0) ensurePump();
    });
  };

  const enqueue = (line: string, opts?: { important?: boolean }) => {
    if (!params.logLine) return;

    const rawLine = String(line ?? '');
    const safeLine = params.redact ? params.redact(rawLine) : rawLine;
    const important = Boolean(opts?.important);

    // Backpressure: keep a bounded queue by dropping non-important messages first.
    if (queue.length >= maxQueueSize) {
      const dropIndex = queue.findIndex((item) => !item.important);
      if (dropIndex >= 0) queue.splice(dropIndex, 1);
      else queue.shift();
    }

    queue.push({ line: safeLine, important });
    ensurePump();
  };

  const flushBestEffort = async (timeoutMs: number) => {
    if (!params.logLine) return;
    if (!pumpPromise && queue.length === 0) return;
    const wait = pumpPromise ?? Promise.resolve();
    await Promise.race([wait, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
  };

  return { enqueue, flushBestEffort };
};

export const buildMergedProcessEnv = (
  overrides?: Record<string, string | undefined>
): Record<string, string> | undefined => {
  if (!overrides || Object.keys(overrides).length === 0) return undefined;

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'string') env[key] = value;
  }
  return env;
};

