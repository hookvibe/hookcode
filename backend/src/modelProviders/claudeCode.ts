import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { buildMergedProcessEnv, createAsyncLineLogger } from '../utils/providerRuntime';
import { normalizeHttpBaseUrl } from '../utils/url';

export const CLAUDE_CODE_PROVIDER_KEY = 'claude_code' as const;

export type ClaudeCodeCredentialSource = 'user' | 'repo' | 'robot';

export interface ClaudeCodeCredential {
  /**
   * Claude API Base URL (proxy).
   *
   * Notes:
   * - Stored at credential-level so different keys can route to different proxies.
   * - Only `http/https` URLs are accepted (see `normalizeHttpBaseUrl`).
   */
  apiBaseUrl?: string;
  apiKey?: string;
  /**
   * User-defined note for distinguishing credentials in UI.
   */
  remark?: string;
}

export interface ClaudeCodeRobotProviderConfig {
  credentialSource: ClaudeCodeCredentialSource;
  /**
   * Selected credential profile id (when `credentialSource` is `user` or `repo`).
   *
   * Change record:
   * - 2026-01-14: Allow selecting one credential from multiple user/repo-scoped credentials.
   */
  credentialProfileId?: string;
  credential?: ClaudeCodeCredential;
  /**
   * Claude model name (passed through to Claude Code CLI).
   *
   * Notes:
   * - We intentionally accept any non-empty string because model ids evolve frequently.
   * - An empty string means "use Claude Code's default model".
   */
  model: string;
  /**
   * Sandbox intent mapping (HookCode):
   * - read-only: provider can only read/search; no write-capable tools are exposed.
   * - workspace-write: provider can edit files and run commands inside the repo workspace.
   */
  sandbox: 'workspace-write' | 'read-only';
  sandbox_workspace_write: { network_access: boolean };
}

export interface ClaudeCodeCredentialPublic {
  apiBaseUrl?: string;
  hasApiKey: boolean;
  remark?: string;
}

export type ClaudeCodeRobotProviderConfigPublic = Omit<ClaudeCodeRobotProviderConfig, 'credential'> & {
  credential?: ClaudeCodeCredentialPublic;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeCredentialProfileId = (value: unknown): string | undefined => {
  const raw = asString(value).trim();
  return raw ? raw : undefined;
};

const normalizeCredentialSource = (value: unknown): ClaudeCodeCredentialSource => {
  const raw = asString(value).trim().toLowerCase();
  if (raw === 'robot') return 'robot';
  if (raw === 'repo') return 'repo';
  return 'user';
};

const normalizeClaudeModel = (value: unknown): string => {
  const raw = asString(value).trim();
  // Default to a commonly available "Sonnet" model, but still allow users to override with any model id.
  return raw || 'claude-sonnet-4-5-20250929';
};

const normalizeSandbox = (value: unknown): 'workspace-write' | 'read-only' => {
  const raw = asString(value).trim();
  if (raw === 'workspace-write' || raw === 'read-only') return raw;
  return 'read-only';
};

export const getDefaultClaudeCodeRobotProviderConfig = (): ClaudeCodeRobotProviderConfig => ({
  credentialSource: 'user',
  credential: undefined,
  model: 'claude-sonnet-4-5-20250929',
  sandbox: 'read-only',
  sandbox_workspace_write: { network_access: false }
});

export const normalizeClaudeCodeRobotProviderConfig = (raw: unknown): ClaudeCodeRobotProviderConfig => {
  const base = getDefaultClaudeCodeRobotProviderConfig();
  if (!isRecord(raw)) return base;

  const credentialSource = normalizeCredentialSource(raw.credentialSource);
  const credentialProfileId = credentialSource === 'robot' ? undefined : normalizeCredentialProfileId(raw.credentialProfileId);
  const credentialRaw = isRecord(raw.credential) ? raw.credential : null;
  const apiBaseUrl = credentialRaw ? normalizeHttpBaseUrl(asString(credentialRaw.apiBaseUrl)) : undefined;
  const apiKey = credentialRaw ? asString(credentialRaw.apiKey).trim() : '';
  const remark = credentialRaw ? asString(credentialRaw.remark).trim() : '';

  const sandboxWorkspaceWriteRaw = isRecord(raw.sandbox_workspace_write) ? raw.sandbox_workspace_write : null;

  const next: ClaudeCodeRobotProviderConfig = {
    credentialSource,
    credentialProfileId,
    credential:
      credentialSource === 'robot'
        ? {
            apiBaseUrl,
            apiKey: apiKey ? apiKey : undefined
            ,
            remark: remark ? remark : undefined
          }
        : undefined,
    model: normalizeClaudeModel(raw.model),
    sandbox: normalizeSandbox(raw.sandbox),
    sandbox_workspace_write: {
      network_access: asBoolean(sandboxWorkspaceWriteRaw?.network_access, false)
    }
  };

  return next;
};

export const mergeClaudeCodeRobotProviderConfig = (params: {
  existing: unknown;
  next: unknown;
}): ClaudeCodeRobotProviderConfig => {
  const existingNormalized = normalizeClaudeCodeRobotProviderConfig(params.existing);
  const nextNormalized = normalizeClaudeCodeRobotProviderConfig(params.next);

  // Change record: for non-robot credential sources, always drop embedded secrets.
  if (nextNormalized.credentialSource !== 'robot') {
    return { ...nextNormalized, credential: undefined };
  }

  const hasNextApiKey = Boolean((nextNormalized.credential?.apiKey ?? '').trim());
  const existingApiKey = (existingNormalized.credential?.apiKey ?? '').trim();
  const mergedCredential: ClaudeCodeCredential = {
    apiBaseUrl: nextNormalized.credential?.apiBaseUrl,
    apiKey: hasNextApiKey ? nextNormalized.credential?.apiKey : existingApiKey
    ,
    remark: nextNormalized.credential?.remark
  };
  const apiKey = (mergedCredential.apiKey ?? '').trim();
  const remark = (mergedCredential.remark ?? '').trim();

  return {
    ...nextNormalized,
    credential: {
      apiBaseUrl: mergedCredential.apiBaseUrl,
      apiKey: apiKey ? apiKey : undefined
      ,
      remark: remark ? remark : undefined
    }
  };
};

export const toPublicClaudeCodeRobotProviderConfig = (raw: unknown): ClaudeCodeRobotProviderConfigPublic => {
  const normalized = normalizeClaudeCodeRobotProviderConfig(raw);
  const apiKey = (normalized.credential?.apiKey ?? '').trim();
  const hasApiKey = Boolean(apiKey);
  const apiBaseUrl = (normalized.credential?.apiBaseUrl ?? '').trim();
  const remark = (normalized.credential?.remark ?? '').trim();

  return {
    credentialSource: normalized.credentialSource,
    credentialProfileId: normalized.credentialProfileId,
    credential:
      normalized.credentialSource === 'robot'
        ? { hasApiKey, apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined, remark: remark ? remark : undefined }
        : undefined,
    model: normalized.model,
    sandbox: normalized.sandbox,
    sandbox_workspace_write: normalized.sandbox_workspace_write
  };
};

type ClaudeSdkModule = typeof import('@anthropic-ai/claude-agent-sdk');

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;

const importClaudeSdk = async (): Promise<ClaudeSdkModule> =>
  (await dynamicImport('@anthropic-ai/claude-agent-sdk')) as ClaudeSdkModule;

const toSafeJsonLine = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify({ type: 'hookcode_sdk_message', error: 'json_stringify_failed', detail: String(err) });
  }
};

const isPathWithinRoot = (rootDir: string, filePath: string): boolean => {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(filePath);
  if (candidate === root) return true;
  return candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
};

export const runClaudeCodeExecWithSdk = async (params: {
  repoDir: string;
  workspaceDir?: string;
  promptFile: string;
  model: string;
  sandbox: 'read-only' | 'workspace-write';
  networkAccess: boolean;
  resumeSessionId?: string;
  apiKey: string;
  apiBaseUrl?: string;
  outputLastMessageFile: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  redact?: (text: string) => string;
  logLine?: (line: string) => Promise<void>;
  __internal?: {
    importClaudeSdk?: () => Promise<ClaudeSdkModule>;
  };
}): Promise<{ threadId: string | null; finalResponse: string }> => {
  const { query } = await (params.__internal?.importClaudeSdk ? params.__internal.importClaudeSdk() : importClaudeSdk());
  const prompt = await readFile(params.promptFile, 'utf8');

  const abortController = new AbortController();
  const signal = params.signal;
  if (signal) {
    // TypeScript note: capture `signal` so the narrowing is preserved inside the event callback.
    if (signal.aborted) abortController.abort(signal.reason);
    else signal.addEventListener('abort', () => abortController.abort(signal.reason), { once: true });
  }

  const baseTools: string[] = ['Read', 'Grep', 'Glob'];
  if (params.sandbox === 'workspace-write') baseTools.push('Edit', 'Write', 'Bash');
  if (params.networkAccess) baseTools.push('WebFetch', 'WebSearch');

  const apiBaseUrl = normalizeHttpBaseUrl(params.apiBaseUrl);
  const mergedEnv = buildMergedProcessEnv({
    ...params.env,
    // Business intent: allow selecting Claude credentials at runtime without mutating process.env.
    ANTHROPIC_API_KEY: params.apiKey,
    ...(apiBaseUrl
      ? {
          // Business intent: allow routing Claude requests through a proxy by overriding the Anthropic API base URL.
          // Notes:
          // - Claude Code uses `ANTHROPIC_API_KEY` for auth; the base URL override is best-effort and depends on the
          //   underlying SDK honoring these environment variables.
          // - We set both vars to maximize compatibility across SDK versions.
          ANTHROPIC_BASE_URL: apiBaseUrl,
          ANTHROPIC_API_URL: apiBaseUrl
        }
      : {})
  });

  const runOnce = async (resumeSessionId?: string): Promise<{ threadId: string | null; finalResponse: string }> => {
    const logger = createAsyncLineLogger({ logLine: params.logLine, redact: params.redact, maxQueueSize: 500 });
    let threadId: string | null = null;
    let finalResponse = '';
    let resultError: string | null = null;
    const workingDir = params.workspaceDir ?? params.repoDir;

    const q = query({
      prompt,
      options: {
        abortController,
        // Run Claude Code from the task-group root when provided; fall back to repo root. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
        cwd: workingDir,
        env: mergedEnv,
        model: params.model ? params.model : undefined,
        tools: baseTools,
        allowedTools: baseTools,
        // Business intent: HookCode runs unattended; permissions must be deterministic (no interactive prompts).
        permissionMode: 'dontAsk',
        persistSession: true,
        resume: resumeSessionId ? resumeSessionId : undefined,
        forkSession: false,
        sandbox:
          params.sandbox === 'workspace-write'
            ? {
                enabled: true,
                autoAllowBashIfSandboxed: true,
                allowUnsandboxedCommands: false
              }
            : { enabled: true },
        additionalDirectories:
          params.sandbox === 'workspace-write' ? [path.join(params.repoDir, '.git')] : undefined,
        // Safety notes:
        // - Deny any attempt to bypass sandbox (`dangerouslyDisableSandbox`) to avoid full host access.
        // - Enforce repo boundary for file tools to match Codex's workspace directory scoping.
        canUseTool: async (toolName, input) => {
          if (!baseTools.includes(toolName)) {
            return { behavior: 'deny', message: 'Tool is not allowed by this robot configuration.' };
          }

          if ((toolName === 'Read' || toolName === 'Edit' || toolName === 'Write') && typeof (input as any).file_path === 'string') {
            const filePath = String((input as any).file_path);
            if (!path.isAbsolute(filePath) || !isPathWithinRoot(params.repoDir, filePath)) {
              return { behavior: 'deny', message: 'File access outside the repository directory is not allowed.' };
            }
          }

          if ((toolName === 'Grep' || toolName === 'Glob') && typeof (input as any).path === 'string') {
            const targetPath = String((input as any).path);
            if (targetPath && (!path.isAbsolute(targetPath) || !isPathWithinRoot(params.repoDir, targetPath))) {
              return { behavior: 'deny', message: 'Search path outside the repository directory is not allowed.' };
            }
          }

          if (toolName === 'Bash' && (input as any)?.dangerouslyDisableSandbox === true) {
            return { behavior: 'deny', message: 'Dangerously disabling sandbox is not allowed.', interrupt: true };
          }

          return { behavior: 'allow' };
        }
      }
    });

    try {
      for await (const message of q) {
        const sessionId = typeof (message as any)?.session_id === 'string' ? String((message as any).session_id).trim() : '';
        if (sessionId && !threadId) threadId = sessionId;

        if ((message as any)?.type === 'result') {
          if ((message as any)?.subtype === 'success') {
            finalResponse = typeof (message as any)?.result === 'string' ? String((message as any).result) : '';
          } else {
            const errors = Array.isArray((message as any)?.errors) ? (message as any).errors : [];
            resultError = errors.length ? String(errors[0]) : 'claude code execution failed';
          }
        }

        logger.enqueue(toSafeJsonLine(message), {
          important:
            (message as any)?.type === 'result' ||
            ((message as any)?.type === 'system' && (message as any)?.subtype === 'init') ||
            (message as any)?.type === 'auth_status'
        });
        if (resultError) break;
      }
    } finally {
      await logger.flushBestEffort(250);
    }

    const outputPath = path.isAbsolute(params.outputLastMessageFile)
      ? params.outputLastMessageFile
      : path.join(params.repoDir, params.outputLastMessageFile);
    await writeFile(outputPath, finalResponse ?? '', 'utf8');

    if (resultError) throw new Error(resultError);
    return { threadId, finalResponse };
  };

  const resumeId = (params.resumeSessionId ?? '').trim();
  if (resumeId) {
    try {
      return await runOnce(resumeId);
    } catch (err) {
      // Best-effort: if resume fails (stale/foreign session id), fall back to a fresh session.
      if (params.logLine) {
        await params.logLine('[claude_code] resume failed; starting a new session');
      }
      return await runOnce(undefined);
    }
  }

  return await runOnce(undefined);
};
