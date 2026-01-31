import { spawn } from 'child_process';
import { createRequire } from 'module';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { buildMergedProcessEnv, createAsyncLineLogger } from '../utils/providerRuntime';
import { normalizeHttpBaseUrl } from '../utils/url';

export const GEMINI_CLI_PROVIDER_KEY = 'gemini_cli' as const;

export type GeminiCliCredentialSource = 'user' | 'repo' | 'robot';

export interface GeminiCliCredential {
  /**
   * Gemini API Base URL (proxy).
   *
   * Notes:
   * - For Gemini Developer API, HookCode maps this to `GOOGLE_GEMINI_BASE_URL`.
   */
  apiBaseUrl?: string;
  apiKey?: string;
  /**
   * User-defined note for distinguishing credentials in UI.
   */
  remark?: string;
}

export interface GeminiCliRobotProviderConfig {
  credentialSource: GeminiCliCredentialSource;
  /**
   * Selected credential profile id (when `credentialSource` is `user` or `repo`).
   *
   * Change record:
   * - 2026-01-14: Allow selecting one credential from multiple user/repo-scoped credentials.
   */
  credentialProfileId?: string;
  credential?: GeminiCliCredential;
  /**
   * Gemini model name (passed through to Gemini CLI `--model`).
   *
   * Notes:
   * - We intentionally accept any non-empty string because model ids evolve frequently.
   * - An empty string means "use Gemini CLI's default model routing".
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

export interface GeminiCliCredentialPublic {
  apiBaseUrl?: string;
  hasApiKey: boolean;
  remark?: string;
}

export type GeminiCliRobotProviderConfigPublic = Omit<GeminiCliRobotProviderConfig, 'credential'> & {
  credential?: GeminiCliCredentialPublic;
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

const normalizeCredentialSource = (value: unknown): GeminiCliCredentialSource => {
  const raw = asString(value).trim().toLowerCase();
  if (raw === 'robot') return 'robot';
  if (raw === 'repo') return 'repo';
  return 'user';
};

const normalizeGeminiModel = (value: unknown): string => {
  const raw = asString(value).trim();
  // Default to the latest generally available "Pro" model, but still allow users to override with any model id.
  return raw || 'gemini-2.5-pro';
};

const normalizeSandbox = (value: unknown): 'workspace-write' | 'read-only' => {
  const raw = asString(value).trim();
  if (raw === 'workspace-write' || raw === 'read-only') return raw;
  return 'read-only';
};

export const getDefaultGeminiCliRobotProviderConfig = (): GeminiCliRobotProviderConfig => ({
  credentialSource: 'user',
  credential: undefined,
  model: 'gemini-2.5-pro',
  sandbox: 'read-only',
  sandbox_workspace_write: { network_access: false }
});

export const normalizeGeminiCliRobotProviderConfig = (raw: unknown): GeminiCliRobotProviderConfig => {
  const base = getDefaultGeminiCliRobotProviderConfig();
  if (!isRecord(raw)) return base;

  const credentialSource = normalizeCredentialSource(raw.credentialSource);
  const credentialProfileId = credentialSource === 'robot' ? undefined : normalizeCredentialProfileId(raw.credentialProfileId);
  const credentialRaw = isRecord(raw.credential) ? raw.credential : null;
  const apiBaseUrl = credentialRaw ? normalizeHttpBaseUrl(asString(credentialRaw.apiBaseUrl)) : undefined;
  const apiKey = credentialRaw ? asString(credentialRaw.apiKey).trim() : '';
  const remark = credentialRaw ? asString(credentialRaw.remark).trim() : '';

  const sandboxWorkspaceWriteRaw = isRecord(raw.sandbox_workspace_write) ? raw.sandbox_workspace_write : null;

  const next: GeminiCliRobotProviderConfig = {
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
    model: normalizeGeminiModel(raw.model),
    sandbox: normalizeSandbox(raw.sandbox),
    sandbox_workspace_write: {
      network_access: asBoolean(sandboxWorkspaceWriteRaw?.network_access, false)
    }
  };

  return next;
};

export const mergeGeminiCliRobotProviderConfig = (params: {
  existing: unknown;
  next: unknown;
}): GeminiCliRobotProviderConfig => {
  const existingNormalized = normalizeGeminiCliRobotProviderConfig(params.existing);
  const nextNormalized = normalizeGeminiCliRobotProviderConfig(params.next);

  // Change record: for non-robot credential sources, always drop embedded secrets.
  if (nextNormalized.credentialSource !== 'robot') {
    return { ...nextNormalized, credential: undefined };
  }

  const hasNextApiKey = Boolean((nextNormalized.credential?.apiKey ?? '').trim());
  const existingApiKey = (existingNormalized.credential?.apiKey ?? '').trim();
  const mergedCredential: GeminiCliCredential = {
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

export const toPublicGeminiCliRobotProviderConfig = (raw: unknown): GeminiCliRobotProviderConfigPublic => {
  const normalized = normalizeGeminiCliRobotProviderConfig(raw);
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

type GeminiCliOutputInit = { type: 'init'; session_id?: string };
type GeminiCliOutputResult = {
  type: 'result';
  result?: { output?: string; text?: string };
  stats?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

const nodeRequire = createRequire(__filename);

const resolveGeminiCliEntrypoint = async (): Promise<string> => {
  // Business intent: avoid relying on global `gemini` installs or PATH shims in production.
  const pkgJsonPath = nodeRequire.resolve('@google/gemini-cli/package.json');
  const pkgDir = path.dirname(pkgJsonPath);
  const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8')) as { bin?: string | Record<string, string> };

  const binRel =
    typeof pkg.bin === 'string'
      ? pkg.bin
      : typeof pkg.bin?.gemini === 'string'
        ? pkg.bin.gemini
        : pkg.bin && typeof pkg.bin === 'object'
          ? Object.values(pkg.bin)[0]
          : '';

  if (!binRel) {
    throw new Error('gemini_cli entrypoint not found in @google/gemini-cli package.json');
  }

  return path.resolve(pkgDir, binRel);
};

const toSafeJsonLine = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify({ type: 'hookcode_cli_message', error: 'json_stringify_failed', detail: String(err) });
  }
};

const buildSystemSettings = (params: {
  sandbox: 'read-only' | 'workspace-write';
  networkAccess: boolean;
}): Record<string, unknown> => {
  // Security notes:
  // - Run on untrusted repositories: keep the tool surface minimal and deterministic.
  // - Always disable hooks explicitly so a repo cannot opt-in to executing local scripts via workspace settings.
  const coreTools: string[] = ['list_directory', 'read_file', 'glob', 'search_file_content'];
  if (params.sandbox === 'workspace-write') coreTools.push('write_file', 'replace', 'run_shell_command');
  if (params.networkAccess) coreTools.push('web_fetch', 'google_web_search');

  return {
    tools: { core: coreTools, exclude: [] },
    hooks: { enabled: false }
  };
};

const buildPolicyToml = (params: { allowTools: string[] }): string => {
  const allowTools = params.allowTools.map((t) => String(t).trim()).filter(Boolean);
  const toolsToml = allowTools.map((tool) => `"${tool.replace(/"/g, '\\"')}"`).join(', ');

  return [
    // Business intent: single high-priority rule that auto-allows the configured core tools for headless runs.
    'version = "1.0"',
    '',
    '[[rules]]',
    'id = "hookcode-auto-allow-core-tools"',
    'description = "HookCode: auto-allow the configured core tools for non-interactive executions."',
    `tools = [${toolsToml}]`,
    'decision = "allow"',
    ''
  ].join('\n');
};

const parseJsonIfPossible = (line: string): unknown | null => {
  const trimmed = String(line ?? '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const extractInit = (parsed: unknown): GeminiCliOutputInit | null => {
  if (!isRecord(parsed)) return null;
  if (parsed.type !== 'init') return null;
  const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id.trim() : '';
  return { type: 'init', session_id: sessionId ? sessionId : undefined };
};

const extractResult = (parsed: unknown): GeminiCliOutputResult | null => {
  if (!isRecord(parsed)) return null;
  if (parsed.type !== 'result') return null;
  const resultRaw = isRecord(parsed.result) ? (parsed.result as Record<string, unknown>) : null;
  const statsRaw = isRecord(parsed.stats) ? (parsed.stats as Record<string, unknown>) : null;
  return {
    type: 'result',
    result: resultRaw
      ? {
          output: typeof resultRaw.output === 'string' ? resultRaw.output : undefined,
          text: typeof resultRaw.text === 'string' ? resultRaw.text : undefined
        }
      : undefined,
    stats: statsRaw
      ? {
          input_tokens: typeof statsRaw.input_tokens === 'number' ? statsRaw.input_tokens : undefined,
          output_tokens: typeof statsRaw.output_tokens === 'number' ? statsRaw.output_tokens : undefined,
          total_tokens: typeof statsRaw.total_tokens === 'number' ? statsRaw.total_tokens : undefined
        }
      : undefined
  };
};

export const runGeminiCliExecWithCli = async (params: {
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
  geminiHomeDir: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  redact?: (text: string) => string;
  logLine?: (line: string) => Promise<void>;
  __internal?: {
    resolveGeminiCliEntrypoint?: () => Promise<string>;
    spawn?: typeof spawn;
  };
}): Promise<{ threadId: string | null; finalResponse: string }> => {
  const prompt = await readFile(params.promptFile, 'utf8');
  const resolvedEntrypoint = await (params.__internal?.resolveGeminiCliEntrypoint
    ? params.__internal.resolveGeminiCliEntrypoint()
    : resolveGeminiCliEntrypoint());

  const systemSettings = buildSystemSettings({ sandbox: params.sandbox, networkAccess: params.networkAccess });
  const coreTools = isRecord(systemSettings.tools) && Array.isArray((systemSettings.tools as any).core) ? ((systemSettings.tools as any).core as string[]) : [];

  await mkdir(params.geminiHomeDir, { recursive: true });
  const systemSettingsPath = path.join(params.geminiHomeDir, 'hookcode-gemini-system-settings.json');
  await writeFile(systemSettingsPath, JSON.stringify(systemSettings, null, 2), 'utf8');

  const policyDir = path.join(params.geminiHomeDir, '.gemini', 'policies');
  await mkdir(policyDir, { recursive: true });
  const policyPath = path.join(policyDir, 'hookcode.toml');
  await writeFile(policyPath, buildPolicyToml({ allowTools: coreTools }), 'utf8');

  const apiBaseUrl = normalizeHttpBaseUrl(params.apiBaseUrl);
  const mergedEnv = buildMergedProcessEnv({
    ...params.env,
    // Business intent: allow selecting Gemini credentials at runtime without mutating process.env.
    GEMINI_API_KEY: params.apiKey,
    ...(apiBaseUrl
      ? {
          // Business intent: allow routing Gemini requests through a proxy by overriding the Gemini API base URL.
          // Notes:
          // - Gemini CLI uses `@google/genai` internally; that SDK honors `GOOGLE_GEMINI_BASE_URL`.
          // - We keep the override at runtime so robots can select different proxies per credential profile.
          GOOGLE_GEMINI_BASE_URL: apiBaseUrl
        }
      : {}),
    // Security intent: isolate Gemini CLI state (sessions, caches, policies) per execution scope.
    HOME: params.geminiHomeDir,
    USERPROFILE: params.geminiHomeDir,
    GEMINI_CLI_SYSTEM_SETTINGS_PATH: systemSettingsPath
  });

  const runOnce = async (resumeSessionId?: string): Promise<{ threadId: string | null; finalResponse: string }> => {
    const spawnFn = params.__internal?.spawn ?? spawn;
    const args = [
      resolvedEntrypoint,
      '--output-format',
      'stream-json',
      ...(params.model ? ['--model', params.model] : []),
      ...(resumeSessionId ? ['--resume', resumeSessionId] : [])
    ];

    const workingDir = params.workspaceDir ?? params.repoDir;
    const child = spawnFn(process.execPath, args, {
      // Run Gemini CLI from the task-group root when provided; fall back to repo root. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      cwd: workingDir,
      env: mergedEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const logger = createAsyncLineLogger({ logLine: params.logLine, redact: params.redact, maxQueueSize: 800 });

    let threadId: string | null = null;
    let finalResponse = '';
    let stderrTail = '';
    let stdoutTail = '';

    const captureTail = (current: string, next: string, maxLen: number) => {
      const merged = (current + '\n' + next).trim();
      if (merged.length <= maxLen) return merged;
      return merged.slice(merged.length - maxLen);
    };

    const stdoutRl = readline.createInterface({ input: child.stdout });
    const stderrRl = readline.createInterface({ input: child.stderr });

    stdoutRl.on('line', (line) => {
      const raw = String(line ?? '');
      stdoutTail = captureTail(stdoutTail, raw, 2000);
      logger.enqueue(raw, { important: raw.includes('"type":"init"') || raw.includes('"type":"result"') });

      const parsed = parseJsonIfPossible(raw);
      if (!parsed) return;
      const init = extractInit(parsed);
      if (init?.session_id && !threadId) threadId = init.session_id;
      const result = extractResult(parsed);
      if (result) {
        const output = (result.result?.output ?? result.result?.text ?? '').trimEnd();
        if (output) finalResponse = output;
      }
    });

    stderrRl.on('line', (line) => {
      const raw = String(line ?? '');
      stderrTail = captureTail(stderrTail, raw, 2000);
      logger.enqueue(raw, { important: true });
    });

    const abort = () => {
      // Best-effort: propagate cancellations to the CLI process.
      if (!child.killed) child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 1500).unref();
    };

    if (params.signal) {
      if (params.signal.aborted) abort();
      else params.signal.addEventListener('abort', abort, { once: true });
    }

    try {
      if (child.stdin) {
        child.stdin.write(prompt);
        child.stdin.end();
      }

      const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.on('error', (err) => reject(err));
        child.on('close', (code, signal) => resolve({ code, signal }));
      });

      stdoutRl.close();
      stderrRl.close();

      const outputPath = path.isAbsolute(params.outputLastMessageFile)
        ? params.outputLastMessageFile
        : path.join(params.repoDir, params.outputLastMessageFile);
      await writeFile(outputPath, finalResponse ?? '', 'utf8');

      if (exit.signal) {
        throw new Error(`gemini_cli terminated by signal ${exit.signal}`);
      }
      if (exit.code !== 0) {
        const detail = [stderrTail, stdoutTail].filter(Boolean).join('\n');
        const suffix = detail ? `\n${detail}` : '';
        throw new Error(`gemini_cli exited with code ${exit.code}${suffix}`);
      }

      return { threadId, finalResponse };
    } finally {
      await logger.flushBestEffort(250);
    }
  };

  const resumeId = (params.resumeSessionId ?? '').trim();
  if (resumeId) {
    try {
      return await runOnce(resumeId);
    } catch (err) {
      // Best-effort: if resume fails (stale/foreign session id), fall back to a fresh session.
      if (params.logLine) {
        await params.logLine('[gemini_cli] resume failed; starting a new session');
      }
      return await runOnce(undefined);
    }
  }

  return await runOnce(undefined);
};
