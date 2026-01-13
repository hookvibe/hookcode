import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type {
  ThreadEvent as CodexSdkThreadEvent,
  ThreadOptions as CodexSdkThreadOptions,
  ModelReasoningEffort as CodexSdkModelReasoningEffort
} from '@openai/codex-sdk';
import { buildMergedProcessEnv, createAsyncLineLogger } from '../utils/providerRuntime';

export const CODEX_PROVIDER_KEY = 'codex' as const;
export type ModelProviderKey = typeof CODEX_PROVIDER_KEY | (string & {});

export type CodexModel = 'gpt-5.2' | 'gpt-5.1-codex-max' | 'gpt-5.1-codex-mini';
export type CodexSandbox = 'read-only' | 'workspace-write' | 'danger-full-access';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type CodexCredentialSource = 'user' | 'repo' | 'robot';

export interface CodexCredential {
  apiBaseUrl?: string;
  apiKey?: string;
}

export interface CodexRobotProviderConfig {
  credentialSource: CodexCredentialSource;
  credential?: CodexCredential;
  model: CodexModel;
  sandbox: 'workspace-write' | 'read-only';
  model_reasoning_effort: CodexReasoningEffort;
  sandbox_workspace_write: { network_access: boolean };
}

export interface CodexCredentialPublic {
  apiBaseUrl?: string;
  hasApiKey: boolean;
}

export type CodexRobotProviderConfigPublic = Omit<CodexRobotProviderConfig, 'credential'> & {
  credential?: CodexCredentialPublic;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeCredentialSource = (value: unknown): CodexCredentialSource => {
  const raw = asString(value).trim().toLowerCase();
  if (raw === 'robot') return 'robot';
  if (raw === 'repo') return 'repo';
  return 'user';
};

const normalizeCodexModel = (value: unknown): CodexModel => {
  const raw = asString(value).trim();
  if (raw === 'gpt-5.2' || raw === 'gpt-5.1-codex-max' || raw === 'gpt-5.1-codex-mini') return raw;
  return 'gpt-5.1-codex-max';
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
  model_reasoning_effort: 'medium',
  sandbox_workspace_write: { network_access: false }
});

export const normalizeCodexRobotProviderConfig = (raw: unknown): CodexRobotProviderConfig => {
  const base = getDefaultCodexRobotProviderConfig();
  if (!isRecord(raw)) return base;

  const credentialSource = normalizeCredentialSource(raw.credentialSource);
  const credentialRaw = isRecord(raw.credential) ? raw.credential : null;
  const apiBaseUrl = credentialRaw ? asString(credentialRaw.apiBaseUrl).trim() : '';
  const apiKey = credentialRaw ? asString(credentialRaw.apiKey).trim() : '';

  const sandboxWorkspaceWriteRaw = isRecord(raw.sandbox_workspace_write) ? raw.sandbox_workspace_write : null;

  const next: CodexRobotProviderConfig = {
    credentialSource,
    credential:
      credentialSource === 'robot'
        ? {
          apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
          apiKey: apiKey ? apiKey : undefined
        }
        : undefined,
    model: normalizeCodexModel(raw.model),
    sandbox: normalizeCodexSandbox(raw.sandbox),
    model_reasoning_effort: normalizeReasoningEffort(raw.model_reasoning_effort),
    sandbox_workspace_write: {
      network_access: asBoolean(sandboxWorkspaceWriteRaw?.network_access, false)
    }
  };

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
    apiKey: hasNextApiKey ? nextNormalized.credential?.apiKey : existingApiKey
  };
  const apiKey = (mergedCredential.apiKey ?? '').trim();

  return {
    ...nextNormalized,
    credential: {
      apiBaseUrl: mergedCredential.apiBaseUrl,
      apiKey: apiKey ? apiKey : undefined
    }
  };
};

export const toPublicCodexRobotProviderConfig = (raw: unknown): CodexRobotProviderConfigPublic => {
  const normalized = normalizeCodexRobotProviderConfig(raw);
  const apiKey = (normalized.credential?.apiKey ?? '').trim();
  const hasApiKey = Boolean(apiKey);
  const apiBaseUrl = (normalized.credential?.apiBaseUrl ?? '').trim();

  return {
    credentialSource: normalized.credentialSource,
    credential: normalized.credentialSource === 'robot' ? { apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined, hasApiKey } : undefined,
    model: normalized.model,
    sandbox: normalized.sandbox,
    model_reasoning_effort: normalized.model_reasoning_effort,
    sandbox_workspace_write: normalized.sandbox_workspace_write
  };
};

type CodexSdkModule = typeof import('@openai/codex-sdk');

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;

const importCodexSdk = async (): Promise<CodexSdkModule> => (await dynamicImport('@openai/codex-sdk')) as CodexSdkModule;

export const normalizeCodexApiBaseUrl = (raw: string): string | undefined => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return undefined;
  if (/\s/.test(trimmed)) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    // Avoid embedding credentials in URLs (they may get logged or leaked through model context).
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

export const buildCodexSdkThreadOptions = (params: {
  repoDir: string;
  model: CodexModel;
  sandbox: 'read-only' | 'workspace-write';
  modelReasoningEffort: CodexReasoningEffort;
  networkAccess: boolean;
}): CodexSdkThreadOptions => {
  const sandboxMode = params.sandbox || 'read-only';

  return {
    model: params.model,
    sandboxMode,
    workingDirectory: params.repoDir,
    skipGitRepoCheck: true,
    approvalPolicy: 'never',
    modelReasoningEffort: params.modelReasoningEffort as CodexSdkModelReasoningEffort,
    networkAccessEnabled: params.networkAccess,
    additionalDirectories: sandboxMode === 'workspace-write' ? [path.join(params.repoDir, '.git')] : undefined
  };
};

export const runCodexExecWithSdk = async (params: {
  repoDir: string;
  promptFile: string;
  model: CodexModel;
  sandbox: 'read-only' | 'workspace-write';
  modelReasoningEffort: CodexReasoningEffort;
  networkAccess: boolean;
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
    modelReasoningEffort: params.modelReasoningEffort,
    networkAccess: params.networkAccess
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
      if (turnFailedMessage || streamErrorMessage) break;
    }
  } finally {
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
