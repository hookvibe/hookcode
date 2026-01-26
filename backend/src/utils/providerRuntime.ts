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

/**
 * Build merged environment for model provider execution (e.g., Codex/Claude sandbox).
 *
 * Key behavior:
 * - If GIT_HTTP_PROXY is set, inject http_proxy/https_proxy/HTTP_PROXY/HTTPS_PROXY into the env.
 *   This ensures git commands inside the sandbox use the correct proxy instead of the
 *   user's ~/.gitconfig (which may have 127.0.0.1 that is unreachable from sandbox).
 * - Env var proxy has higher priority than git config, so this overrides any global settings.
 *
 * docs/en/developer/plans/gitproxyfix20260127/task_plan.md gitproxyfix20260127
 */
export const buildMergedProcessEnv = (
  overrides?: Record<string, string | undefined>
): Record<string, string> | undefined => {
  const env: Record<string, string> = {};

  // Copy current process env
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }

  // Apply overrides
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'string') env[key] = value;
    }
  }

  // Inject proxy env vars from GIT_HTTP_PROXY so git commands inside sandbox use correct proxy.
  // This overrides any proxy set in ~/.gitconfig (e.g., 127.0.0.1 which is unreachable from sandbox).
  // gitproxyfix20260127
  const gitHttpProxy = (process.env.GIT_HTTP_PROXY ?? '').trim();
  if (gitHttpProxy) {
    // Set both lowercase and uppercase variants for maximum compatibility
    env.http_proxy = gitHttpProxy;
    env.https_proxy = gitHttpProxy;
    env.HTTP_PROXY = gitHttpProxy;
    env.HTTPS_PROXY = gitHttpProxy;
  }

  // Return undefined if env is effectively empty (only if no changes were made)
  if (Object.keys(env).length === 0) return undefined;

  return env;
};

