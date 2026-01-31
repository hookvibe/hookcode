import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import type {
  ThreadEvent as CodexSdkThreadEvent,
  ThreadOptions as CodexSdkThreadOptions,
  ModelReasoningEffort as CodexSdkModelReasoningEffort
} from '@openai/codex-sdk';
import { buildMergedProcessEnv, createAsyncLineLogger } from '../utils/providerRuntime';
import { normalizeHttpBaseUrl } from '../utils/url';

export const CODEX_PROVIDER_KEY = 'codex' as const;
export type ModelProviderKey = typeof CODEX_PROVIDER_KEY | (string & {});

export type CodexModel = string;
export type CodexSandbox = 'read-only' | 'workspace-write' | 'danger-full-access';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type CodexCredentialSource = 'user' | 'repo' | 'robot';

export interface CodexCredential {
  apiBaseUrl?: string;
  apiKey?: string;
  /**
   * User-defined note for distinguishing credentials in UI.
   *
   * Change record:
   * - 2026-01-14: Added `remark` so users can label per-robot credentials.
   */
  remark?: string;
}

export interface CodexRobotProviderConfig {
  credentialSource: CodexCredentialSource;
  /**
   * Selected credential profile id (when `credentialSource` is `user` or `repo`).
   *
   * Change record:
   * - 2026-01-14: Allow selecting one credential from multiple user/repo-scoped credentials.
   */
  credentialProfileId?: string;
  credential?: CodexCredential;
  model: CodexModel;
  sandbox: 'workspace-write' | 'read-only';
  model_reasoning_effort: CodexReasoningEffort;
  // Codex execution always enables network access; the robot config no longer binds this setting. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
}

export interface CodexCredentialPublic {
  apiBaseUrl?: string;
  hasApiKey: boolean;
  remark?: string;
}

export type CodexRobotProviderConfigPublic = Omit<CodexRobotProviderConfig, 'credential'> & {
  credential?: CodexCredentialPublic;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

type CodexFileChangeKind = 'create' | 'update' | 'delete' | (string & {});

type HookcodeFileDiffEvent = {
  type: 'hookcode.file.diff';
  item_id: string;
  path: string;
  kind?: CodexFileChangeKind;
  unified_diff: string;
  old_text?: string;
  new_text?: string;
};

const MAX_CODEX_DIFF_CHARS = 200_000;
const MAX_CODEX_SNAPSHOT_CHARS = 200_000;

const normalizeRepoRelativePath = (params: { repoDir: string; rawPath: string }): string | null => {
  const raw = String(params.rawPath ?? '').trim();
  if (!raw) return null;
  const rel = path.isAbsolute(raw) ? path.relative(params.repoDir, raw) : raw;
  const normalized = rel.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!normalized) return null;
  if (normalized.startsWith('..')) return null;
  return normalized;
};

const runGit = async (
  repoDir: string,
  args: string[],
  options?: { maxStdoutChars?: number }
): Promise<{ ok: boolean; stdout: string }> => {
  // Capture git output for diff artifacts without blocking the main provider loop. yjlphd6rbkrq521ny796
  const maxStdoutChars = typeof options?.maxStdoutChars === 'number' && options.maxStdoutChars > 0 ? options.maxStdoutChars : 0;

  return await new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      if (maxStdoutChars > 0 && stdout.length >= maxStdoutChars) return;
      stdout += chunk.toString('utf8');
      if (maxStdoutChars > 0 && stdout.length > maxStdoutChars) stdout = stdout.slice(0, maxStdoutChars);
    });

    // Avoid leaking git errors into logs; diff capture is best-effort. yjlphd6rbkrq521ny796
    child.on('close', (code) => resolve({ ok: code === 0, stdout }));
    child.on('error', () => resolve({ ok: false, stdout }));
  });
};

const safeReadUtf8 = async (absPath: string): Promise<string | null> => {
  try {
    const text = await readFile(absPath, 'utf8');
    return text;
  } catch {
    return null;
  }
};

const sliceMax = (value: string | null, maxChars: number): string | undefined => {
  if (!value) return undefined;
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
};

const captureCodexFileDiffEvents = async (params: {
  repoDir: string;
  itemId: string;
  changes: Array<{ path: string; kind?: CodexFileChangeKind }>;
  __internal?: {
    runGit?: typeof runGit;
    readFileUtf8?: typeof safeReadUtf8;
  };
}): Promise<HookcodeFileDiffEvent[]> => {
  const runGitImpl = params.__internal?.runGit ?? runGit;
  const readFileImpl = params.__internal?.readFileUtf8 ?? safeReadUtf8;

  const events: HookcodeFileDiffEvent[] = [];

  for (const change of params.changes) {
    const relPath = normalizeRepoRelativePath({ repoDir: params.repoDir, rawPath: change.path });
    if (!relPath) continue;

    const unifiedRes = await runGitImpl(params.repoDir, ['diff', '--no-color', '--unified=3', '--', relPath], {
      maxStdoutChars: MAX_CODEX_DIFF_CHARS
    });
    const unified = unifiedRes.stdout.trimEnd();
    if (!unified) continue;

    // Use snapshots (HEAD vs working tree) for richer diff rendering on the frontend. yjlphd6rbkrq521ny796
    const oldRes = await runGitImpl(params.repoDir, ['show', `HEAD:${relPath}`], { maxStdoutChars: MAX_CODEX_SNAPSHOT_CHARS });
    const oldText = oldRes.ok ? oldRes.stdout : null;
    const newAbs = path.join(params.repoDir, relPath);
    const newText = await readFileImpl(newAbs);

    events.push({
      type: 'hookcode.file.diff',
      item_id: params.itemId,
      path: relPath,
      kind: change.kind,
      unified_diff: unified,
      old_text: sliceMax(oldText, MAX_CODEX_SNAPSHOT_CHARS),
      new_text: sliceMax(newText, MAX_CODEX_SNAPSHOT_CHARS)
    });
  }

  return events;
};

const normalizeCredentialProfileId = (value: unknown): string | undefined => {
  const raw = asString(value).trim();
  return raw ? raw : undefined;
};

const normalizeCredentialSource = (value: unknown): CodexCredentialSource => {
  const raw = asString(value).trim().toLowerCase();
  if (raw === 'robot') return 'robot';
  if (raw === 'repo') return 'repo';
  return 'user';
};

const normalizeCodexModel = (value: unknown): CodexModel => {
  const raw = asString(value).trim();
  // Accept any non-empty model id so the UI can dynamically discover models per credential. b8fucnmey62u0muyn7i0
  return raw || 'gpt-5.1-codex-max';
};

const normalizeCodexSandbox = (value: unknown): 'workspace-write' | 'read-only' => {
  const raw = asString(value).trim();
  if (raw === 'workspace-write' || raw === 'read-only') return raw;
  return 'read-only';
};

const normalizeReasoningEffort = (value: unknown): CodexReasoningEffort => {
  const raw = asString(value).trim();
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'xhigh') return raw;
  return 'medium';
};

export const getDefaultCodexRobotProviderConfig = (): CodexRobotProviderConfig => ({
  credentialSource: 'user',
  credential: undefined,
  model: 'gpt-5.1-codex-max',
  sandbox: 'read-only',
  model_reasoning_effort: 'medium'
});

export const normalizeCodexRobotProviderConfig = (raw: unknown): CodexRobotProviderConfig => {
  const base = getDefaultCodexRobotProviderConfig();
  if (!isRecord(raw)) return base;

  const credentialSource = normalizeCredentialSource(raw.credentialSource);
  const credentialProfileId = credentialSource === 'robot' ? undefined : normalizeCredentialProfileId(raw.credentialProfileId);
  const credentialRaw = isRecord(raw.credential) ? raw.credential : null;
  const apiBaseUrl = credentialRaw ? asString(credentialRaw.apiBaseUrl).trim() : '';
  const apiKey = credentialRaw ? asString(credentialRaw.apiKey).trim() : '';
  const remark = credentialRaw ? asString(credentialRaw.remark).trim() : '';

  const next: CodexRobotProviderConfig = {
    credentialSource,
    credentialProfileId,
    credential:
      credentialSource === 'robot'
        ? {
          apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
          apiKey: apiKey ? apiKey : undefined,
          remark: remark ? remark : undefined
        }
        : undefined,
    model: normalizeCodexModel(raw.model),
    sandbox: normalizeCodexSandbox(raw.sandbox),
    model_reasoning_effort: normalizeReasoningEffort(raw.model_reasoning_effort)
  };

  // Ignore legacy sandbox_workspace_write.network_access because Codex now always allows network access. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
  return next;
};

export const mergeCodexRobotProviderConfig = (params: {
  existing: unknown;
  next: unknown;
}): CodexRobotProviderConfig => {
  const existingNormalized = normalizeCodexRobotProviderConfig(params.existing);
  const nextNormalized = normalizeCodexRobotProviderConfig(params.next);

  if (nextNormalized.credentialSource !== 'robot') {
    return { ...nextNormalized, credential: undefined };
  }

  const hasNextApiKey = Boolean(nextNormalized.credential?.apiKey);
  const existingApiKey = existingNormalized.credential?.apiKey;
  const mergedCredential: CodexCredential = {
    apiBaseUrl: nextNormalized.credential?.apiBaseUrl,
    apiKey: hasNextApiKey ? nextNormalized.credential?.apiKey : existingApiKey,
    remark: nextNormalized.credential?.remark
  };
  const apiKey = (mergedCredential.apiKey ?? '').trim();
  const remark = (mergedCredential.remark ?? '').trim();

  return {
    ...nextNormalized,
    credential: {
      apiBaseUrl: mergedCredential.apiBaseUrl,
      apiKey: apiKey ? apiKey : undefined,
      remark: remark ? remark : undefined
    }
  };
};

export const toPublicCodexRobotProviderConfig = (raw: unknown): CodexRobotProviderConfigPublic => {
  const normalized = normalizeCodexRobotProviderConfig(raw);
  const apiKey = (normalized.credential?.apiKey ?? '').trim();
  const hasApiKey = Boolean(apiKey);
  const apiBaseUrl = (normalized.credential?.apiBaseUrl ?? '').trim();
  const remark = (normalized.credential?.remark ?? '').trim();

  return {
    credentialSource: normalized.credentialSource,
    credentialProfileId: normalized.credentialProfileId,
    credential:
      normalized.credentialSource === 'robot'
        ? { apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined, hasApiKey, remark: remark ? remark : undefined }
        : undefined,
    model: normalized.model,
    sandbox: normalized.sandbox,
    model_reasoning_effort: normalized.model_reasoning_effort
  };
};

type CodexSdkModule = typeof import('@openai/codex-sdk');

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;

const importCodexSdk = async (): Promise<CodexSdkModule> => (await dynamicImport('@openai/codex-sdk')) as CodexSdkModule;

export const normalizeCodexApiBaseUrl = (raw: string): string | undefined => {
  // Change record: reuse shared URL normalization to keep Codex/Claude/Gemini base URL validation consistent.
  return normalizeHttpBaseUrl(raw);
};

export const buildCodexSdkThreadOptions = (params: {
  repoDir: string;
  model: CodexModel;
  sandbox: 'read-only' | 'workspace-write';
  modelReasoningEffort: CodexReasoningEffort;
}): CodexSdkThreadOptions => {
  const sandboxMode = params.sandbox || 'read-only';

  return {
    model: params.model,
    sandboxMode,
    workingDirectory: params.repoDir,
    skipGitRepoCheck: true,
    approvalPolicy: 'never',
    modelReasoningEffort: params.modelReasoningEffort as CodexSdkModelReasoningEffort,
    // Always enable Codex network access; the SDK no longer reads this from robot config. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
    networkAccessEnabled: true,
    additionalDirectories: sandboxMode === 'workspace-write' ? [path.join(params.repoDir, '.git')] : undefined
  };
};

export const runCodexExecWithSdk = async (params: {
  repoDir: string;
  promptFile: string;
  model: CodexModel;
  sandbox: 'read-only' | 'workspace-write';
  modelReasoningEffort: CodexReasoningEffort;
  resumeThreadId?: string;
  apiKey: string;
  apiBaseUrl?: string;
  outputLastMessageFile: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  redact?: (text: string) => string;
  logLine?: (line: string) => Promise<void>;
  __internal?: {
    importCodexSdk?: () => Promise<CodexSdkModule>;
    captureCodexFileDiffEvents?: typeof captureCodexFileDiffEvents;
    runGit?: typeof runGit;
    readFileUtf8?: typeof safeReadUtf8;
  };
}): Promise<{ threadId: string | null; finalResponse: string }> => {
  const { Codex } = await (params.__internal?.importCodexSdk ? params.__internal.importCodexSdk() : importCodexSdk());
  const prompt = await readFile(params.promptFile, 'utf8');

  const codex = new Codex({
    apiKey: params.apiKey,
    baseUrl: normalizeCodexApiBaseUrl(params.apiBaseUrl ?? ''),
    // Change record: use shared env merger to keep providers consistent.
    env: buildMergedProcessEnv(params.env)
  });

  const threadOptions = buildCodexSdkThreadOptions({
    repoDir: params.repoDir,
    model: params.model,
    sandbox: params.sandbox,
    // Thread options now always enable network access for Codex runs. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
    modelReasoningEffort: params.modelReasoningEffort
  });
  const resumeThreadId = (params.resumeThreadId ?? '').trim();
  const thread = resumeThreadId
    ? (() => {
      try {
        return codex.resumeThread(resumeThreadId, threadOptions);
      } catch (err) {
        console.warn('[codex] resumeThread failed; starting a new thread instead', { error: err });
        return codex.startThread(threadOptions);
      }
    })()
    : codex.startThread(threadOptions);

  let threadId: string | null = null;
  let finalResponse = '';
  let turnFailedMessage = '';
  let streamErrorMessage = '';
  const sideTasks: Promise<void>[] = [];

  // Change record: use shared async logger to avoid blocking provider execution on DB/log persistence.
  const logger = createAsyncLineLogger({ logLine: params.logLine, redact: params.redact, maxQueueSize: 500 });
  const { events } = await thread.runStreamed(prompt, { signal: params.signal });

  try {
    for await (const event of events) {
      if (event.type === 'thread.started') {
        threadId = event.thread_id;
      }
      if (event.type === 'turn.failed') {
        turnFailedMessage = String(event.error?.message ?? 'codex turn failed');
      }
      if (event.type === 'error') {
        streamErrorMessage = String(event.message ?? 'codex stream error');
      }
      if (
        (event.type === 'item.updated' || event.type === 'item.completed') &&
        event.item?.type === 'agent_message' &&
        typeof event.item.text === 'string'
      ) {
        finalResponse = event.item.text;
      }

      logger.enqueue(JSON.stringify(event), {
        important:
          event.type === 'thread.started' ||
          event.type === 'turn.completed' ||
          event.type === 'turn.failed' ||
          event.type === 'error'
      });

      if ((event.type === 'item.updated' || event.type === 'item.completed') && event.item?.type === 'file_change') {
        const itemId = asString(event.item?.id).trim();
        const changesRaw = Array.isArray(event.item?.changes) ? event.item?.changes : [];
        if (itemId && changesRaw.length > 0) {
          const changes = changesRaw
            .map((entry: unknown) => {
              if (!isRecord(entry)) return null;
              const changePath = asString(entry.path).trim();
              if (!changePath) return null;
              const kind = asString(entry.kind).trim() as CodexFileChangeKind;
              return { path: changePath, kind: kind || undefined };
            })
            .filter((v): v is { path: string; kind: CodexFileChangeKind | undefined } => Boolean(v));

          if (changes.length) {
            const capture =
              params.__internal?.captureCodexFileDiffEvents ??
              ((p: Parameters<typeof captureCodexFileDiffEvents>[0]) =>
                captureCodexFileDiffEvents({
                  ...p,
                  __internal: { runGit: params.__internal?.runGit, readFileUtf8: params.__internal?.readFileUtf8 }
                }));

            // Capture diffs asynchronously so we do not slow down Codex streamed execution. yjlphd6rbkrq521ny796
            sideTasks.push(
              capture({ repoDir: params.repoDir, itemId, changes })
                .then((diffEvents) => {
                  for (const diffEvent of diffEvents) {
                    logger.enqueue(JSON.stringify(diffEvent), { important: true });
                  }
                })
                .catch((err: unknown) => {
                  if (process.env.NODE_ENV !== 'test') {
                    console.warn('[codex] capture file diffs failed (ignored)', { error: err });
                  }
                })
            );
          }
        }
      }

      if (turnFailedMessage || streamErrorMessage) break;
    }
  } finally {
    // Best-effort: wait for background diff capture tasks before flushing logs. yjlphd6rbkrq521ny796
    if (sideTasks.length > 0) {
      await Promise.race([
        Promise.allSettled(sideTasks).then(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1500))
      ]);
    }
    await logger.flushBestEffort(250);
  }

  const outputPath = path.isAbsolute(params.outputLastMessageFile)
    ? params.outputLastMessageFile
    : path.join(params.repoDir, params.outputLastMessageFile);
  await writeFile(outputPath, finalResponse ?? '', 'utf8');

  if (streamErrorMessage) throw new Error(streamErrorMessage);
  if (turnFailedMessage) throw new Error(turnFailedMessage);

  return { threadId: threadId ?? thread.id, finalResponse };
};
