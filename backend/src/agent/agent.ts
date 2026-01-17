import { spawn } from 'child_process';
import { mkdir, rm, writeFile, stat, readFile, chmod } from 'fs/promises';
import path from 'path';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Task, TaskResult } from '../types/task';
import {
  addTaskTokenUsage,
  extractClaudeCodeExecThreadIdFromLine,
  extractClaudeCodeExecTokenUsageDeltaFromLine,
  extractCodexExecThreadIdFromLine,
  extractCodexExecTokenUsageDeltaFromLine,
  extractGeminiCliExecThreadIdFromLine,
  extractGeminiCliExecTokenUsageDeltaFromLine,
  type TaskTokenUsage
} from '../services/taskTokenUsage';
import { buildPrompt } from './promptBuilder';
import { postToProvider } from './reporter';
import type { RepoRobotWithToken } from '../modules/repositories/repo-robot.service';
import type { RepoProvider, Repository } from '../types/repository';
import type { RepoRobot } from '../types/repoRobot';
import { selectRobotForTask } from './robots';
import { GitlabService } from '../services/gitlabService';
import { GithubService } from '../services/githubService';
import { CODEX_PROVIDER_KEY, normalizeCodexRobotProviderConfig, runCodexExecWithSdk } from '../modelProviders/codex';
import {
  CLAUDE_CODE_PROVIDER_KEY,
  normalizeClaudeCodeRobotProviderConfig,
  runClaudeCodeExecWithSdk
} from '../modelProviders/claudeCode';
import {
  GEMINI_CLI_PROVIDER_KEY,
  normalizeGeminiCliRobotProviderConfig,
  runGeminiCliExecWithCli
} from '../modelProviders/geminiCli';
import { isTaskLogsDbEnabled } from '../config/features';
import { isTruthy } from '../utils/env';
import type { UserModelCredentials } from '../modules/users/user.service';
import {
  getGitCloneAuth as resolveGitCloneAuth,
  inferRobotRepoProviderCredentialSource,
  resolveRobotProviderToken
} from '../services/repoRobotAccess';
import type {
  RepoScopedModelProviderCredentials,
  RepoScopedRepoProviderCredentials,
  RepositoryService
} from '../modules/repositories/repository.service';
import type { RepoRobotService } from '../modules/repositories/repo-robot.service';
import type { TaskService } from '../modules/tasks/task.service';
import type { TaskLogStream } from '../modules/tasks/task-log-stream.service';
import type { UserService } from '../modules/users/user.service';
import {
  getGithubRepoSlugFromPayload,
  getGitlabProjectIdFromPayload,
  getGitlabProjectPathWithNamespaceFromPayload
} from '../utils/repoPayload';
// Keep git workflow helpers in a shared util so hooks/agent logic can be unit-tested. 24yz61mdik7tqdgaa152
import { canTokenPushToUpstream, normalizeGitRemoteUrl } from '../utils/gitWorkflow';

/**
 * Core task execution (callAgent):
 * - Entry: `backend/src/services/taskRunner.ts` calls `callAgent(task)` after it claims a queued task.
 * - Behavior: clones/updates the target repo under `backend/src/agent/build/`, writes the prompt file, runs the selected model
 *   provider (Codex / Claude Code / Gemini CLI), writes output to an output file, and posts the result back to the provider (GitLab/GitHub).
 * - Change record: extended the provider execution paths from Codex-only to include Claude Code (`claude_code`) and Gemini CLI (`gemini_cli`).
 * - Logs: continuously writes logs into `tasks.result.logs` (see `backend/src/services/taskService.ts`) and pushes them in-process via `taskLogStream`,
 *   which powers console SSE (`backend/src/routes/tasks.ts`) and the frontend log viewer (`frontend/src/components/TaskLogViewer.tsx`).
 * - Security: redacts sensitive info in external logs (tokens / URL basic auth) to avoid storing secrets in DB or provider comments.
 */
const BUILD_ROOT = path.join(__dirname, 'build');
const MAX_LOG_LINES = 1000;

let taskService: TaskService;
let taskLogStream: TaskLogStream;
let repositoryService: RepositoryService;
let repoRobotService: RepoRobotService;
let userService: UserService;

export const setAgentServices = (services: {
  taskService: TaskService;
  taskLogStream: TaskLogStream;
  repositoryService: RepositoryService;
  repoRobotService: RepoRobotService;
  userService: UserService;
}) => {
  taskService = services.taskService;
  taskLogStream = services.taskLogStream;
  repositoryService = services.repositoryService;
  repoRobotService = services.repoRobotService;
  userService = services.userService;
};

const assertAgentServicesReady = () => {
  if (!taskService || !taskLogStream || !repositoryService || !repoRobotService || !userService) {
    throw new Error('[agent] services are not initialized (missing setAgentServices call)');
  }
};

const formatRef = (ref?: string) => ref?.replace(/^refs\/heads\//, '');
const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const pickCredentialProfile = (
  creds: { profiles?: Array<{ id?: string; apiKey?: string; apiBaseUrl?: string }> | null; defaultProfileId?: string } | null | undefined,
  requestedProfileId?: string | null
): { apiKey: string; apiBaseUrl: string; profileId: string } | null => {
  // Business intent: robots can pick one credential profile from user-scope/repo-scope stores.
  //
  // Notes:
  // - Prefer explicit `requestedProfileId`, then provider-level `defaultProfileId`, then the first profile.
  // - Keep this best-effort: controllers validate ids, but workers should still be resilient to missing data.
  const profiles = Array.isArray(creds?.profiles) ? creds!.profiles : [];
  const requestedId = safeTrim(requestedProfileId);
  const defaultId = safeTrim((creds as any)?.defaultProfileId);

  const selected =
    (requestedId && profiles.find((p) => safeTrim(p?.id) === requestedId)) ||
    (defaultId && profiles.find((p) => safeTrim(p?.id) === defaultId)) ||
    profiles.find((p) => Boolean(p && safeTrim(p?.id)));

  const profileId = safeTrim(selected?.id);
  if (!profileId) return null;
  return {
    profileId,
    apiKey: safeTrim(selected?.apiKey),
    apiBaseUrl: safeTrim(selected?.apiBaseUrl)
  };
};

const toErrorSummary = (err: unknown): Record<string, unknown> => {
  if (err instanceof PrismaClientKnownRequestError) {
    const meta = err.meta && typeof err.meta === 'object' ? (err.meta as Record<string, unknown>) : undefined;
    return {
      name: err.name,
      code: err.code,
      metaCode: meta?.code,
      metaMessage: meta?.message
    };
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { message: String(err) };
};
const shDoubleQuote = (value: string) =>
  `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')}"`;

const resolveRepoDefaultBranch = (repo: Repository | null): string => {
  if (!repo) return '';
  const branches = Array.isArray(repo.branches) ? repo.branches : [];
  const explicit = branches.find((b) => b?.isDefault && safeTrim(b?.name));
  if (explicit) return safeTrim(explicit.name);
  if (branches.length === 1 && safeTrim(branches[0]?.name)) return safeTrim(branches[0].name);
  return '';
};

const resolveBranchByLegacyRole = (repo: Repository | null, role: RepoRobot['defaultBranchRole'] | undefined): string => {
  if (!repo || !role) return '';
  const branches = Array.isArray(repo.branches) ? repo.branches : [];
  const byNote = (keyword: string) => branches.find((b) => safeTrim(b?.note) === keyword && safeTrim(b?.name));

  if (role === 'main') {
    const fromDefault = resolveRepoDefaultBranch(repo);
    if (fromDefault) return fromDefault;
    // Change record (2026-01-15): legacy branch role notes are now stored in English.
    return byNote('Main branch')?.name ?? branches.find((b) => safeTrim(b?.name) === 'main')?.name ?? '';
  }
  if (role === 'dev') return byNote('Dev branch')?.name ?? branches.find((b) => safeTrim(b?.name) === 'dev')?.name ?? '';
  if (role === 'test') return byNote('Test branch')?.name ?? branches.find((b) => safeTrim(b?.name) === 'test')?.name ?? '';
  return '';
};

const resolveCheckoutRef = (params: {
  task: Task;
  payload: any;
  repo: Repository | null;
  robot: RepoRobot;
}): { ref?: string; source: 'event' | 'robot' | 'repo' | 'payload' | 'none' } => {
  const eventRef = safeTrim(formatRef(params.task.ref ?? params.payload?.ref));
  if (eventRef) return { ref: eventRef, source: 'event' };

  const fromRobot = safeTrim(params.robot.defaultBranch);
  if (fromRobot) return { ref: fromRobot, source: 'robot' };

  const fromLegacyRole = resolveBranchByLegacyRole(params.repo, params.robot.defaultBranchRole);
  if (fromLegacyRole) return { ref: fromLegacyRole, source: 'robot' };

  const fromRepo = resolveRepoDefaultBranch(params.repo);
  if (fromRepo) return { ref: fromRepo, source: 'repo' };

  const fromPayload = safeTrim(params.payload?.project?.default_branch || params.payload?.repository?.default_branch);
  if (fromPayload) return { ref: fromPayload, source: 'payload' };

  return { source: 'none' };
};

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const redactUrlAuthInText = (text: string): string =>
  text.replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, '$1$2:***@');

const redactTokensInText = (text: string): string =>
  text
    // GitLab PAT / Project access token
    .replace(/\bglpat-[A-Za-z0-9_-]{12,}\b/g, 'glpat-***')
    // GitHub classic token
    .replace(/\bghp_[A-Za-z0-9]{20,}\b/g, 'ghp_***')
    // GitHub fine-grained token
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, 'github_pat_***')
    // Google API key (Gemini API / Google APIs), commonly starts with `AIza`.
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, 'AIza***')
    // Anthropic API key (sk-ant-*)
    // Change record: Claude Code execution can surface Anthropic keys in error messages.
    .replace(/\bsk-ant-[A-Za-z0-9_-]{12,}\b/g, 'sk-ant-***')
    // OpenAI API key (including sk-proj-*)
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, 'sk-***');

const redactSensitiveText = (text: string): string =>
  redactTokensInText(redactUrlAuthInText(text));

const injectBasicAuth = (
  rawUrl: string,
  auth?: { username: string; password: string }
): { execUrl: string; displayUrl: string } => {
  if (!auth) {
    return { execUrl: rawUrl, displayUrl: redactUrlAuthInText(rawUrl) };
  }
  if (!isHttpUrl(rawUrl)) {
    return { execUrl: rawUrl, displayUrl: redactUrlAuthInText(rawUrl) };
  }
  try {
    const url = new URL(rawUrl);
    if (!url.username && !url.password) {
      url.username = auth.username;
      url.password = auth.password;
    }
    const execUrl = url.toString();
    url.password = '***';
    const displayUrl = url.toString();
    return { execUrl, displayUrl };
  } catch (_err) {
    return { execUrl: rawUrl, displayUrl: redactUrlAuthInText(rawUrl) };
  }
};

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildGitlabLogDetails = (logs: string[]): string => {
  const enabled = isTruthy(process.env.GITLAB_LOG_DETAILS_ENABLED, true);
  if (!enabled) return '';

  const open = isTruthy(process.env.GITLAB_LOG_DETAILS_OPEN, false) ? ' open' : '';
  // Change record (2026-01-15): default log summary label is now English.
  const summary = (process.env.GITLAB_LOG_DETAILS_SUMMARY || 'Execution log').trim() || 'Execution log';
  const detailsBody = escapeHtml(logs.join('\n'));
  return `<details${open}><summary>${escapeHtml(summary)}</summary>\n\n<pre><code>${detailsBody}</code></pre>\n\n</details>`;
};

const getTaskConsoleUrl = (taskId: string): string => {
  const prefixFromEnv = String(process.env.HOOKCODE_CONSOLE_TASK_URL_PREFIX ?? '').trim();
  const baseFromEnv = String(process.env.HOOKCODE_CONSOLE_BASE_URL ?? '').trim();
  const defaultPrefix = (() => {
    const base = baseFromEnv.replace(/\/+$/, '');
    if (base) return `${base}/#/tasks/`;
    return 'http://localhost:5173/#/tasks/';
  })();

  const prefix = prefixFromEnv || defaultPrefix;
  if (prefix.endsWith('/')) return `${prefix}${taskId}`;
  return `${prefix}/${taskId}`;
};

const getRepoCloneUrl = (provider: RepoProvider, payload: any): string | undefined => {
  if (provider === 'gitlab') {
    const project = payload?.project ?? {};
    return project.git_http_url || project.http_url || project.http_url_to_repo;
  }
  if (provider === 'github') {
    const repo = payload?.repository ?? {};
    return repo.clone_url || repo.git_url || repo.html_url;
  }
  return undefined;
};

const getRepoSlug = (provider: RepoProvider, payload: any, fallback: string): string => {
  if (provider === 'gitlab') {
    const project = payload?.project ?? {};
    return (
      project.path_with_namespace?.replace(/\//g, '__') ||
      (project.id ? `project_${project.id}` : fallback)
    );
  }
  if (provider === 'github') {
    const repo = payload?.repository ?? {};
    return repo.full_name?.replace(/\//g, '__') || (repo.id ? `repo_${repo.id}` : fallback);
  }
  return fallback;
};

const getNoteText = (provider: RepoProvider, payload: any): string | undefined => {
  if (provider === 'gitlab') {
    const note = payload?.object_attributes?.note;
    return typeof note === 'string' ? note : undefined;
  }
  if (provider === 'github') {
    const note = payload?.comment?.body;
    return typeof note === 'string' ? note : undefined;
  }
  return undefined;
};

export class AgentExecutionError extends Error {
  readonly logs: string[];
  readonly logsSeq: number;
  readonly providerCommentUrl?: string;

  constructor(message: string, params: { logs: string[]; logsSeq: number; providerCommentUrl?: string; cause?: unknown }) {
    super(message);
    this.name = 'AgentExecutionError';
    this.logs = params.logs;
    this.logsSeq = params.logsSeq;
    this.providerCommentUrl = params.providerCommentUrl;
    if (params.cause !== undefined) {
      (this as any).cause = params.cause;
    }
  }
}

interface ResolvedExecution {
  provider: RepoProvider;
  repo: Repository | null;
  repoScopedCredentials?: {
    // Business context: repo-scoped credentials are optional and can provide provider/model secrets for robots.
    // Change record: extended model provider credentials to include `claude_code` in addition to `codex`.
    repoProvider: RepoScopedRepoProviderCredentials;
    modelProvider: RepoScopedModelProviderCredentials;
  };
  robotsInRepo: RepoRobot[];
  robot: RepoRobotWithToken;
  userId: string;
  userCredentials: UserModelCredentials | null;
  gitlab?: GitlabService;
  github?: GithubService;
}

const resolveExecution = async (
  task: Task,
  payload: any,
  log: (msg: string) => Promise<void>
): Promise<ResolvedExecution> => {
  if (task.repoId) {
    const repo = await repositoryService.getById(task.repoId);
    if (!repo) throw new Error(`repo not found: ${task.repoId}`);
    if (!repo.enabled) throw new Error(`repo disabled: ${task.repoId}`);

    const robots = (await repoRobotService.listByRepoWithToken(repo.id)).filter((r) => r.enabled);
    const noteText = getNoteText(repo.provider, payload);

    let selected = task.robotId ? robots.find((r) => r.id === task.robotId) : undefined;
    if (!selected) {
      selected = selectRobotForTask(task, payload, robots, { noteText });
    }

    if (!selected) {
      throw new Error('no robot configured for repo');
    }

    const apiBaseUrl = repo.apiBaseUrl ?? undefined;
    const provider = repo.provider;
    const defaultCreds = await userService.getDefaultUserCredentialsRaw();
    const userId = defaultCreds?.userId ?? '';
    const userCredentials = defaultCreds?.credentials ?? null;
    const repoScopedCredentials = await repositoryService.getRepoScopedCredentials(repo.id);
    const repoCredentialSource = inferRobotRepoProviderCredentialSource(selected);
    const providerToken = resolveRobotProviderToken({
      provider,
      robot: selected,
      userCredentials,
      repoCredentials: repoScopedCredentials?.repoProvider ?? null,
      source: repoCredentialSource
    });
    if (!providerToken) {
      await log(
        `Warning: robot(${selected.name}) token is not configured; requests may fail for private repositories/APIs`
      );
    }
    const gitlab =
      provider === 'gitlab' ? new GitlabService({ token: providerToken, baseUrl: apiBaseUrl }) : undefined;
    const github =
      provider === 'github' ? new GithubService({ token: providerToken, apiBaseUrl }) : undefined;

    return {
      provider,
      repo,
      repoScopedCredentials: repoScopedCredentials
        ? { repoProvider: repoScopedCredentials.repoProvider, modelProvider: repoScopedCredentials.modelProvider }
        : undefined,
      robotsInRepo: robots,
      robot: selected,
      userId,
      userCredentials,
      gitlab,
      github
    };
  }

  throw new Error(
    'Task is missing repoId: legacy /api/webhook/gitlab has been removed; please re-trigger via /api/webhook/{provider}/{repoId}. Old tasks can be cleared by wiping the tasks table'
  );
};

async function callAgent(task: Task): Promise<{ logs: string[]; logsSeq: number; providerCommentUrl?: string; outputText?: string }> {
  assertAgentServicesReady();

  const logs: string[] = [];
  let logsSeq = 0;
  let execution: ResolvedExecution | null = null;
  let tokenUsage: TaskTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let repoWorkflow: TaskResult['repoWorkflow'] | undefined; // Surface direct-vs-fork workflow to UI/logs. 24yz61mdik7tqdgaa152
  const taskLogsDbEnabled = isTaskLogsDbEnabled(); // Persist task logs based on DB toggle even when user visibility is disabled. nykx5svtlgh050cstyht
  let taskGroupId: string | null = typeof task.groupId === 'string' ? task.groupId.trim() : null;
  let threadIdBound = false;

  let persistLogsDisabled = false;
  let lastPersistErrorAt = 0;
  let lastPersistErrorLogAt = 0;
  const persistLogsBestEffort = async () => {
    if (persistLogsDisabled) return;
    if (!isUuidLike(task.id)) {
      persistLogsDisabled = true;
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[agent] persist logs disabled (invalid task id)', { taskId: task.id });
      }
      return;
    }

    const now = Date.now();
    if (lastPersistErrorAt > 0 && now - lastPersistErrorAt < 5000) return;
    try {
      const patch: any = { tokenUsage };
      if (repoWorkflow) patch.repoWorkflow = repoWorkflow;
      if (taskLogsDbEnabled) {
        patch.logs = logs;
        patch.logsSeq = logsSeq;
      }
      await taskService.patchResult(task.id, patch);
    } catch (err) {
      lastPersistErrorAt = now;
      if (now - lastPersistErrorLogAt > 30_000) {
        lastPersistErrorLogAt = now;
        console.warn('[agent] persist logs failed (will retry)', { taskId: task.id, error: toErrorSummary(err) });
      }
    }
  };

  const appendLine = async (line: string) => {
    if (!taskLogsDbEnabled) return;
    logsSeq += 1;
    logs.push(line);
    if (logs.length > MAX_LOG_LINES) {
      logs.splice(0, logs.length - MAX_LOG_LINES);
    }
    taskLogStream.publish(task.id, line);
    console.log(line);
    await persistLogsBestEffort();
  };

  const appendLog = async (msg: string) => {
    await appendLine(`[agent] ${redactSensitiveText(msg)}`);
  };

  const appendRawLog = async (line: string) => {
    const threadId =
      extractCodexExecThreadIdFromLine(line) ??
      extractClaudeCodeExecThreadIdFromLine(line) ??
      extractGeminiCliExecThreadIdFromLine(line);
    if (threadId && !threadIdBound) {
      if (!taskGroupId) {
        taskGroupId = await taskService.ensureTaskGroupId(task);
      }
      if (taskGroupId) {
        threadIdBound = true;
        await taskService.bindTaskGroupThreadId(taskGroupId, threadId);
      }
    }

    const delta =
      extractCodexExecTokenUsageDeltaFromLine(line) ??
      extractClaudeCodeExecTokenUsageDeltaFromLine(line) ??
      extractGeminiCliExecTokenUsageDeltaFromLine(line);
    if (delta) {
      tokenUsage = addTaskTokenUsage(tokenUsage, delta);
    }
    if (!taskLogsDbEnabled) {
      await persistLogsBestEffort();
      return;
    }
    await appendLine(line);
  };

  try {
    const payload: any = task.payload ?? {};
    if (!taskGroupId) {
      taskGroupId = await taskService.ensureTaskGroupId(task);
    }
    const resumeThreadId = taskGroupId ? await taskService.getTaskGroupThreadId(taskGroupId) : null;
    execution = await resolveExecution(task, payload, appendLog);

    const repoUrl: string | undefined = getRepoCloneUrl(execution.provider, payload);
    const repoSlug = getRepoSlug(execution.provider, payload, task.id);
    const checkout = resolveCheckoutRef({
      task,
      payload,
      repo: execution.repo,
      robot: execution.robot
    });
    const checkoutRef = checkout.ref;
    const refSlug = checkoutRef ? checkoutRef.replace(/[^\w.-]/g, '_') : 'default';
    const repoDir = path.join(BUILD_ROOT, `${execution.provider}__${repoSlug}__${refSlug}`);

    if (!repoUrl) {
      await appendLog('Repository URL not found; cannot proceed');
      throw new Error('missing repo url');
    }

    await mkdir(BUILD_ROOT, { recursive: true });

    await appendLog(`Preparing work directory ${repoDir}`);
    if (checkoutRef) {
      await appendLog(`This task will check out branch: ${checkoutRef} (source: ${checkout.source})`);
    } else {
      await appendLog('No checkout branch specified; using the repository default branch');
    }
    let repoExists = false;
    try {
      await stat(repoDir);
      repoExists = true;
    } catch (_) {
      repoExists = false;
    }

    const cloneRepo = async () => {
      const injected = upstreamInjected;

      if (checkoutRef) {
        try {
          await appendLog(`Cloning repository (branch ${checkoutRef}) ${injected.displayUrl}`);
          await streamCommand(
            `git clone --branch ${shDoubleQuote(checkoutRef)} ${shDoubleQuote(injected.execUrl)} ${shDoubleQuote(repoDir)}`,
            appendRawLog,
            {
              env: { GIT_TERMINAL_PROMPT: '0' },
              redact: redactSensitiveText
            }
          );
          return;
        } catch (err: any) {
          await appendLog(`Branch clone failed; falling back to default clone: ${err?.message || err}`);
        }
      }

      await appendLog(`Cloning repository ${injected.displayUrl}`);
      await streamCommand(
        `git clone ${shDoubleQuote(injected.execUrl)} ${shDoubleQuote(repoDir)}`,
        appendRawLog,
        {
          env: { GIT_TERMINAL_PROMPT: '0' },
          redact: redactSensitiveText
        }
      );
    };

    const repoCredentialSource = inferRobotRepoProviderCredentialSource(execution.robot);
    const cloneAuth = resolveGitCloneAuth({
      provider: execution.provider,
      robot: execution.robot,
      userCredentials: execution.userCredentials,
      repoCredentials: execution.repoScopedCredentials?.repoProvider ?? null,
      source: repoCredentialSource
    });
    const upstreamInjected = injectBasicAuth(repoUrl, cloneAuth); // Ensure fetch/pull always uses upstream even after remotes drift. 24yz61mdik7tqdgaa152

    if (!repoExists) {
      await cloneRepo();
    } else {
      await appendLog(`Updating repository ${repoDir}`);
      try {
        await streamCommand(`cd ${repoDir} && git remote set-url origin ${shDoubleQuote(upstreamInjected.execUrl)}`, appendRawLog, {
          env: { GIT_TERMINAL_PROMPT: '0' },
          redact: redactSensitiveText
        });
        await streamCommand(`cd ${repoDir} && git fetch origin`, appendRawLog, {
          env: { GIT_TERMINAL_PROMPT: '0' },
          redact: redactSensitiveText
        });
      } catch (err: any) {
        await appendLog(`git fetch failed; trying to re-clone: ${err.message || err}`);
        await rm(repoDir, { recursive: true, force: true });
        await cloneRepo();
      }
    }

    if (checkoutRef) {
      try {
        await appendLog(`Checking out branch ${checkoutRef}`);
        await streamCommand(`cd ${repoDir} && git checkout ${shDoubleQuote(checkoutRef)}`, appendRawLog, {
          env: { GIT_TERMINAL_PROMPT: '0' },
          redact: redactSensitiveText
        });
        await streamCommand(
          `cd ${repoDir} && git pull --no-rebase origin ${shDoubleQuote(checkoutRef)}`,
          appendRawLog,
          {
            env: { GIT_TERMINAL_PROMPT: '0' },
            redact: redactSensitiveText
          }
        );
      } catch (err: any) {
        await appendLog(`Checkout/pull failed: ${err.message || err}`);
      }
    } else if (repoExists) {
      try {
        await appendLog('Updating default branch');
        await streamCommand(`cd ${repoDir} && git pull --no-rebase`, appendRawLog, {
          env: { GIT_TERMINAL_PROMPT: '0' },
          redact: redactSensitiveText
        });
      } catch (err: any) {
        await appendLog(`Default branch update failed: ${err.message || err}`);
      }
    }

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const installGitPrePushGuard = async (params: { expectedUpstream: string; expectedPush: string }) => {
      // Install a repo-local guard to prevent accidental pushes to the wrong remote. 24yz61mdik7tqdgaa152
      const hookDir = path.join(repoDir, '.git', 'hooks');
      const hookPath = path.join(hookDir, 'pre-push');
      await mkdir(hookDir, { recursive: true });

      const script = `#!/bin/sh
# Guard pushes to ensure origin fetch/push targets stay correct for fork workflows. 24yz61mdik7tqdgaa152
set -e

normalize_url() {
  raw="$1"
  if [ -z "$raw" ]; then
    echo ""
    return 0
  fi
  # Strip basic auth and normalize common HTTPS URLs (avoid leaking credentials in error output).
  echo "$raw" | sed -E 's#(https?://)[^@/[:space:]]+@#\\1#g; s#\\.git$##I; s#/*$##'
}

expected_upstream="$(git config --get hookcode.upstream_url 2>/dev/null || true)"
expected_push="$(git config --get hookcode.push_url 2>/dev/null || true)"

if [ -z "$expected_upstream" ] || [ -z "$expected_push" ]; then
  exit 0
fi

origin_fetch="$(git remote get-url origin 2>/dev/null || true)"
origin_push="$(git remote get-url --push origin 2>/dev/null || true)"

norm_fetch="$(normalize_url "$origin_fetch")"
norm_push="$(normalize_url "$origin_push")"
norm_expected_upstream="$(normalize_url "$expected_upstream")"
norm_expected_push="$(normalize_url "$expected_push")"

if [ "$norm_fetch" != "$norm_expected_upstream" ]; then
  echo "[hookcode] Blocked push: origin(fetch) is '$norm_fetch' but expected '$norm_expected_upstream'." 1>&2
  exit 1
fi

if [ "$norm_push" != "$norm_expected_push" ]; then
  echo "[hookcode] Blocked push: origin(push) is '$norm_push' but expected '$norm_expected_push'." 1>&2
  exit 1
fi

exit 0
`;

      await writeFile(hookPath, script, 'utf8');
      await chmod(hookPath, 0o755);

      const expectedUpstream = normalizeGitRemoteUrl(params.expectedUpstream);
      const expectedPush = normalizeGitRemoteUrl(params.expectedPush);
      await streamCommand(
        `cd ${repoDir} && git config --local hookcode.upstream_url ${shDoubleQuote(expectedUpstream)} && git config --local hookcode.push_url ${shDoubleQuote(expectedPush)}`,
        appendRawLog,
        { redact: redactSensitiveText }
      );
    };

    const isProviderStatusError = (provider: RepoProvider, status: number, err: unknown): boolean => {
      const message = err instanceof Error ? err.message : String(err);
      return message.startsWith(`[${provider}] ${status} `);
    };

    const ensureGithubForkRepo = async (params: {
      upstream: { owner: string; repo: string };
    }): Promise<{ slug: string; webUrl?: string; cloneUrl?: string } | null> => {
      if (!execution!.github) return null;
      const me = await execution!.github.getCurrentUser();
      const forkOwner = safeTrim(me?.login);
      if (!forkOwner) throw new Error('github current user login is missing');

      const forkSlug = `${forkOwner}/${params.upstream.repo}`;
      try {
        const existing = await execution!.github.getRepository(forkOwner, params.upstream.repo);
        const parentFull = safeTrim((existing as any)?.parent?.full_name);
        const expectedParent = `${params.upstream.owner}/${params.upstream.repo}`;
        if ((existing as any)?.fork && parentFull.toLowerCase() === expectedParent.toLowerCase()) {
          return {
            slug: forkSlug,
            webUrl: safeTrim((existing as any)?.html_url) || undefined,
            cloneUrl: safeTrim((existing as any)?.clone_url) || undefined
          };
        }
        throw new Error(`existing repo ${forkSlug} is not a fork of ${expectedParent}`);
      } catch (err: any) {
        if (!isProviderStatusError('github', 404, err)) throw err;
      }

      await appendLog(`Creating fork ${forkSlug} for upstream PR workflow`);
      try {
        await execution!.github.createFork(params.upstream.owner, params.upstream.repo);
      } catch (err: any) {
        // If the fork already exists, GitHub may return a conflict; fall back to polling. 24yz61mdik7tqdgaa152
        await appendLog(`Fork request failed (will retry lookup): ${err?.message || err}`);
      }

      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        try {
          const forkRepo = await execution!.github.getRepository(forkOwner, params.upstream.repo);
          return {
            slug: forkSlug,
            webUrl: safeTrim((forkRepo as any)?.html_url) || undefined,
            cloneUrl: safeTrim((forkRepo as any)?.clone_url) || undefined
          };
        } catch (err: any) {
          if (!isProviderStatusError('github', 404, err)) throw err;
          await sleep(1500);
        }
      }
      throw new Error(`fork not ready after timeout: ${forkSlug}`);
    };

    const ensureGitlabForkProject = async (params: {
      upstreamProject: string | number;
    }): Promise<{ slug: string; webUrl?: string; cloneUrl?: string } | null> => {
      if (!execution!.gitlab) return null;
      const upstream = await execution!.gitlab.getProject(params.upstreamProject);
      const upstreamId = upstream.id;

      const forks = await execution!.gitlab.listProjectForks(upstreamId, { owned: true, perPage: 100, page: 1 });
      if (forks.length) {
        const picked = forks[0];
        return {
          slug: safeTrim(picked.path_with_namespace),
          webUrl: safeTrim((picked as any)?.web_url) || undefined,
          cloneUrl: safeTrim((picked as any)?.http_url_to_repo) || undefined
        };
      }

      await appendLog(`Creating fork for upstream MR workflow (project ${upstreamId})`);
      let forked: any;
      try {
        forked = await execution!.gitlab.forkProject(upstreamId, { mrDefaultTargetSelf: false });
      } catch (err: any) {
        if (!isProviderStatusError('gitlab', 409, err)) throw err;
        const retry = await execution!.gitlab.listProjectForks(upstreamId, { owned: true, perPage: 100, page: 1 });
        if (!retry.length) throw err;
        forked = retry[0];
      }

      const forkId = typeof forked?.id === 'number' ? forked.id : null;
      if (!forkId) throw new Error('gitlab fork response is missing project id');

      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        const current = await execution!.gitlab.getProject(forkId);
        const importStatus = safeTrim((current as any)?.import_status).toLowerCase();
        if (!importStatus || importStatus === 'finished') {
          return {
            slug: safeTrim(current.path_with_namespace),
            webUrl: safeTrim((current as any)?.web_url) || undefined,
            cloneUrl: safeTrim((current as any)?.http_url_to_repo) || undefined
          };
        }
        await sleep(1500);
      }
      throw new Error(`fork not ready after timeout: gitlab project ${forkId}`);
    };

    const configureGitWorkflow = async () => {
      const repoCredentialSource = inferRobotRepoProviderCredentialSource(execution!.robot);
      const auth = resolveGitCloneAuth({
        provider: execution!.provider,
        robot: execution!.robot,
        userCredentials: execution!.userCredentials,
        repoCredentials: execution!.repoScopedCredentials?.repoProvider ?? null,
        source: repoCredentialSource
      });

      const upstream: {
        slug?: string;
        webUrl?: string;
        cloneUrl?: string;
        github?: { owner: string; repo: string } | null;
        gitlabProject?: string | number | null;
      } = (() => {
        if (execution!.provider === 'github') {
          const slug = getGithubRepoSlugFromPayload(payload);
          const full = slug ? `${slug.owner}/${slug.repo}` : '';
          return {
            slug: full || undefined,
            webUrl: safeTrim(payload?.repository?.html_url) || undefined,
            cloneUrl: safeTrim(payload?.repository?.clone_url) || safeTrim(repoUrl) || undefined,
            github: slug ? { owner: slug.owner, repo: slug.repo } : null,
            gitlabProject: null
          };
        }

        const pathWithNamespace = getGitlabProjectPathWithNamespaceFromPayload(payload) ?? '';
        const projectId = getGitlabProjectIdFromPayload(task, payload);
        const projectIdentity = projectId ?? (pathWithNamespace ? pathWithNamespace : null);
        const cloneUrl =
          safeTrim(payload?.project?.git_http_url || payload?.project?.http_url || payload?.project?.http_url_to_repo) ||
          safeTrim(repoUrl) ||
          undefined;
        return {
          slug: pathWithNamespace ? pathWithNamespace : undefined,
          webUrl: safeTrim(payload?.project?.web_url) || undefined,
          cloneUrl,
          github: null,
          gitlabProject: projectIdentity
        };
      })();

      const upstreamInjected = injectBasicAuth(repoUrl, auth);
      await streamCommand(
        `cd ${repoDir} && git remote set-url origin ${shDoubleQuote(upstreamInjected.execUrl)}`,
        appendRawLog,
        { env: { GIT_TERMINAL_PROMPT: '0' }, redact: redactSensitiveText }
      );

      const writeEnabled = execution!.robot.permission === 'write';
      const upstreamCanPush = canTokenPushToUpstream(execution!.provider, execution!.robot.repoTokenRepoRole);

      if (!writeEnabled) {
        repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
        await persistLogsBestEffort();
        return;
      }

      const expectedUpstreamUrl = upstream.cloneUrl || repoUrl;
      // Always reset origin push URL first to avoid stale fork pushUrl when fork setup is skipped/fails. 24yz61mdik7tqdgaa152
      await streamCommand(
        `cd ${repoDir} && git remote set-url --push origin ${shDoubleQuote(upstreamInjected.execUrl)}`,
        appendRawLog,
        { env: { GIT_TERMINAL_PROMPT: '0' }, redact: redactSensitiveText }
      );
      await installGitPrePushGuard({ expectedUpstream: expectedUpstreamUrl, expectedPush: expectedUpstreamUrl });

      if (upstreamCanPush) {
        repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
        await persistLogsBestEffort();
        return;
      }

      if (execution!.provider === 'github' && upstream.github) {
        const fork = await ensureGithubForkRepo({ upstream: upstream.github });
        const forkCloneUrl = safeTrim(fork?.cloneUrl);
        if (!fork || !forkCloneUrl) {
          await appendLog('Fork workflow skipped: fork repository clone URL is missing');
          repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
          await persistLogsBestEffort();
          return;
        }

        const forkInjected = injectBasicAuth(forkCloneUrl, auth);
        await streamCommand(
          `cd ${repoDir} && git remote set-url --push origin ${shDoubleQuote(forkInjected.execUrl)}`,
          appendRawLog,
          { env: { GIT_TERMINAL_PROMPT: '0' }, redact: redactSensitiveText }
        );
        await installGitPrePushGuard({ expectedUpstream: upstream.cloneUrl || repoUrl, expectedPush: forkCloneUrl });
        repoWorkflow = { mode: 'fork', provider: execution!.provider, upstream: upstream, fork: fork };
        await appendLog(`Fork workflow enabled: upstream=${upstream.slug ?? 'unknown'} fork=${fork.slug}`);
        await persistLogsBestEffort();
        return;
      }

      if (execution!.provider === 'gitlab' && upstream.gitlabProject) {
        const fork = await ensureGitlabForkProject({ upstreamProject: upstream.gitlabProject });
        const forkCloneUrl = safeTrim(fork?.cloneUrl) || (safeTrim(fork?.webUrl) ? `${safeTrim(fork?.webUrl)}.git` : '');
        if (!fork || !forkCloneUrl) {
          await appendLog('Fork workflow skipped: fork project clone URL is missing');
          repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
          await persistLogsBestEffort();
          return;
        }

        const forkInjected = injectBasicAuth(forkCloneUrl, auth);
        await streamCommand(
          `cd ${repoDir} && git remote set-url --push origin ${shDoubleQuote(forkInjected.execUrl)}`,
          appendRawLog,
          { env: { GIT_TERMINAL_PROMPT: '0' }, redact: redactSensitiveText }
        );
        await installGitPrePushGuard({ expectedUpstream: upstream.cloneUrl || repoUrl, expectedPush: forkCloneUrl });
        repoWorkflow = { mode: 'fork', provider: execution!.provider, upstream: upstream, fork: fork };
        await appendLog(`Fork workflow enabled: upstream=${upstream.slug ?? 'unknown'} fork=${fork.slug}`);
        await persistLogsBestEffort();
        return;
      }

      repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
      await persistLogsBestEffort();
    };

    try {
      await configureGitWorkflow();
    } catch (err: any) {
      await appendLog(`Git workflow setup failed (continuing): ${err?.message || err}`);
    }

    // Build prompt based on robot type.
    const promptCtx = await buildPrompt({
      task,
      payload,
      repo: execution.repo,
      checkout: { branch: checkoutRef ?? '', source: checkout.source },
      robot: execution.robot,
      robotsInRepo: execution.robotsInRepo,
      gitlab: execution.gitlab,
      github: execution.github
    });
    const promptFile = path.join(repoDir, '.codex_prompt.txt');
    await writeFile(promptFile, promptCtx.body, 'utf8');

    // Run the selected model provider (default: codex).
    const modelProvider = safeTrim(execution.robot.modelProvider).toLowerCase() || CODEX_PROVIDER_KEY;
    const isCodexProvider = modelProvider === CODEX_PROVIDER_KEY;
    const isClaudeCodeProvider = modelProvider === CLAUDE_CODE_PROVIDER_KEY;
    const isGeminiCliProvider = modelProvider === GEMINI_CLI_PROVIDER_KEY;
    if (!isCodexProvider && !isClaudeCodeProvider && !isGeminiCliProvider) {
      await appendLog(`Unsupported model provider: ${modelProvider}`);
      throw new Error(`unsupported model provider: ${modelProvider}`);
    }

    const outputLastMessageFile = isClaudeCodeProvider
      ? 'claude-output.txt'
      : isGeminiCliProvider
        ? 'gemini-output.txt'
        : 'codex-output.txt';
    await rm(path.join(repoDir, outputLastMessageFile), { force: true });

    const codexCfg = isCodexProvider ? normalizeCodexRobotProviderConfig(execution.robot.modelProviderConfigRaw) : null;
    const claudeCfg = isClaudeCodeProvider ? normalizeClaudeCodeRobotProviderConfig(execution.robot.modelProviderConfigRaw) : null;
    const geminiCfg = isGeminiCliProvider ? normalizeGeminiCliRobotProviderConfig(execution.robot.modelProviderConfigRaw) : null;
    const sandboxMode = isCodexProvider
      ? codexCfg!.sandbox
      : isClaudeCodeProvider
        ? claudeCfg!.sandbox
        : geminiCfg!.sandbox;
    const networkAccess = isCodexProvider
      ? codexCfg!.sandbox_workspace_write.network_access
      : isClaudeCodeProvider
        ? claudeCfg!.sandbox_workspace_write.network_access
        : geminiCfg!.sandbox_workspace_write.network_access;

    // Enforce a repo-local git identity for workspace-write runs to ensure commits match the token owner.
    const tokenUserName = safeTrim(execution.robot.repoTokenUserName);
    const tokenUserEmail = safeTrim(execution.robot.repoTokenUserEmail);
    let gitUserName = '';
    let gitUserEmail = '';

    if (sandboxMode === 'workspace-write') {
      gitUserName = tokenUserName;
      gitUserEmail = tokenUserEmail;
      if (!gitUserName || !gitUserEmail) {
        await appendLog(
          'Missing token-derived git identity for workspace-write robot (run activation test to populate user.name/user.email)'
        );
        throw new Error('missing git identity for workspace-write robot');
      }
      try {
        await appendLog(`Configuring git identity: ${gitUserName} <${gitUserEmail}>`);
        await streamCommand(
          `cd ${repoDir} && git config --local user.name ${shDoubleQuote(gitUserName)} && git config --local user.email ${shDoubleQuote(gitUserEmail)}`,
          appendRawLog,
          { redact: redactSensitiveText }
        );
      } catch (err: any) {
        await appendLog(`Failed to configure git identity: ${err.message || err}`);
        throw err;
      }
    }

    let threadId: string | null = null;
    let finalResponse = '';

    if (isCodexProvider) {
      const credentialSource = codexCfg!.credentialSource;
      const robotApiKey = (codexCfg!.credential?.apiKey ?? '').trim();
      const robotApiBaseUrl = (codexCfg!.credential?.apiBaseUrl ?? '').trim();

      const userProfile =
        credentialSource === 'user' ? pickCredentialProfile(execution.userCredentials?.codex, codexCfg!.credentialProfileId) : null;
      const repoProfile =
        credentialSource === 'repo'
          ? pickCredentialProfile(execution.repoScopedCredentials?.modelProvider?.codex, codexCfg!.credentialProfileId)
          : null;

      const userApiKey = credentialSource === 'user' ? safeTrim(userProfile?.apiKey) : '';
      const userApiBaseUrl = credentialSource === 'user' ? safeTrim(userProfile?.apiBaseUrl) : '';
      const repoApiKey =
        credentialSource === 'repo' ? safeTrim(repoProfile?.apiKey) : '';
      const repoApiBaseUrl =
        credentialSource === 'repo' ? safeTrim(repoProfile?.apiBaseUrl) : '';

      const apiKey = credentialSource === 'robot' ? robotApiKey : credentialSource === 'repo' ? repoApiKey : userApiKey;
      const apiBaseUrl =
        credentialSource === 'robot' ? robotApiBaseUrl : credentialSource === 'repo' ? repoApiBaseUrl : userApiBaseUrl;

      if (!apiKey) {
        const credentialBack =
          credentialSource === 'robot'
            ? 'codex apiKey is required (robot credential)'
            : credentialSource === 'repo'
              ? 'codex apiKey is required (repo-scoped credential profile)'
              : 'codex apiKey is required (user credential profile)';
        await appendLog(credentialBack);
        throw new Error(credentialBack);
      }

      // Change record: avoid noisy debug `console.error` logs; rely on structured logs + per-task appendLog instead.
      const res = await runCodexExecWithSdk({
        repoDir,
        promptFile,
        model: codexCfg!.model,
        sandbox: codexCfg!.sandbox,
        modelReasoningEffort: codexCfg!.model_reasoning_effort,
        networkAccess,
        resumeThreadId: resumeThreadId || undefined,
        apiKey,
        apiBaseUrl: apiBaseUrl || undefined,
        outputLastMessageFile,
        env: {
          ...(sandboxMode === 'workspace-write'
            ? {
                GIT_AUTHOR_NAME: gitUserName,
                GIT_AUTHOR_EMAIL: gitUserEmail,
                GIT_COMMITTER_NAME: gitUserName,
                GIT_COMMITTER_EMAIL: gitUserEmail
              }
            : {})
        },
        redact: redactSensitiveText,
        logLine: appendRawLog
      });
      threadId = res.threadId;
      finalResponse = res.finalResponse;
    } else if (isClaudeCodeProvider) {
      const credentialSource = claudeCfg!.credentialSource;
      const robotApiKey = (claudeCfg!.credential?.apiKey ?? '').trim();
      const robotApiBaseUrl = (claudeCfg!.credential?.apiBaseUrl ?? '').trim();

      const userProfile =
        credentialSource === 'user'
          ? pickCredentialProfile(execution.userCredentials?.claude_code, claudeCfg!.credentialProfileId)
          : null;
      const repoProfile =
        credentialSource === 'repo'
          ? pickCredentialProfile(execution.repoScopedCredentials?.modelProvider?.claude_code, claudeCfg!.credentialProfileId)
          : null;

      const userApiKey = credentialSource === 'user' ? safeTrim(userProfile?.apiKey) : '';
      const userApiBaseUrl = credentialSource === 'user' ? safeTrim(userProfile?.apiBaseUrl) : '';
      const repoApiKey =
        credentialSource === 'repo' ? safeTrim(repoProfile?.apiKey) : '';
      const repoApiBaseUrl =
        credentialSource === 'repo' ? safeTrim(repoProfile?.apiBaseUrl) : '';

      const apiKey = credentialSource === 'robot' ? robotApiKey : credentialSource === 'repo' ? repoApiKey : userApiKey;
      const apiBaseUrl =
        credentialSource === 'robot' ? robotApiBaseUrl : credentialSource === 'repo' ? repoApiBaseUrl : userApiBaseUrl;

      if (!apiKey) {
        const credentialBack =
          credentialSource === 'robot'
            ? 'claude_code apiKey is required (robot credential)'
            : credentialSource === 'repo'
              ? 'claude_code apiKey is required (repo-scoped credential profile)'
              : 'claude_code apiKey is required (user credential profile)';
        await appendLog(credentialBack);
        throw new Error(credentialBack);
      }

      const res = await runClaudeCodeExecWithSdk({
        repoDir,
        promptFile,
        model: claudeCfg!.model,
        sandbox: claudeCfg!.sandbox,
        networkAccess,
        resumeSessionId: resumeThreadId || undefined,
        apiKey,
        apiBaseUrl: apiBaseUrl || undefined,
        outputLastMessageFile,
        env: {
          ...(sandboxMode === 'workspace-write'
            ? {
                GIT_AUTHOR_NAME: gitUserName,
                GIT_AUTHOR_EMAIL: gitUserEmail,
                GIT_COMMITTER_NAME: gitUserName,
                GIT_COMMITTER_EMAIL: gitUserEmail
              }
            : {})
        },
        redact: redactSensitiveText,
        logLine: appendRawLog
      });
      threadId = res.threadId;
      finalResponse = res.finalResponse;
    } else {
      const credentialSource = geminiCfg!.credentialSource;
      const robotApiKey = (geminiCfg!.credential?.apiKey ?? '').trim();
      const robotApiBaseUrl = (geminiCfg!.credential?.apiBaseUrl ?? '').trim();

      const userProfile =
        credentialSource === 'user'
          ? pickCredentialProfile(execution.userCredentials?.gemini_cli, geminiCfg!.credentialProfileId)
          : null;
      const repoProfile =
        credentialSource === 'repo'
          ? pickCredentialProfile(execution.repoScopedCredentials?.modelProvider?.gemini_cli, geminiCfg!.credentialProfileId)
          : null;

      const userApiKey = credentialSource === 'user' ? safeTrim(userProfile?.apiKey) : '';
      const userApiBaseUrl = credentialSource === 'user' ? safeTrim(userProfile?.apiBaseUrl) : '';
      const repoApiKey =
        credentialSource === 'repo' ? safeTrim(repoProfile?.apiKey) : '';
      const repoApiBaseUrl =
        credentialSource === 'repo' ? safeTrim(repoProfile?.apiBaseUrl) : '';

      const apiKey = credentialSource === 'robot' ? robotApiKey : credentialSource === 'repo' ? repoApiKey : userApiKey;
      const apiBaseUrl =
        credentialSource === 'robot' ? robotApiBaseUrl : credentialSource === 'repo' ? repoApiBaseUrl : userApiBaseUrl;

      if (!apiKey) {
        const credentialBack =
          credentialSource === 'robot'
            ? 'gemini_cli apiKey is required (robot credential)'
            : credentialSource === 'repo'
              ? 'gemini_cli apiKey is required (repo-scoped credential profile)'
              : 'gemini_cli apiKey is required (user credential profile)';
        await appendLog(credentialBack);
        throw new Error(credentialBack);
      }

      const geminiScopeId = taskGroupId ? taskGroupId : task.id;
      const geminiHomeDir = path.join(BUILD_ROOT, '.gemini_cli_home', `${execution.provider}__${repoSlug}`, geminiScopeId);

      const res = await runGeminiCliExecWithCli({
        repoDir,
        promptFile,
        model: geminiCfg!.model,
        sandbox: geminiCfg!.sandbox,
        networkAccess,
        resumeSessionId: resumeThreadId || undefined,
        apiKey,
        apiBaseUrl: apiBaseUrl || undefined,
        outputLastMessageFile,
        geminiHomeDir,
        env: {
          ...(sandboxMode === 'workspace-write'
            ? {
                GIT_AUTHOR_NAME: gitUserName,
                GIT_AUTHOR_EMAIL: gitUserEmail,
                GIT_COMMITTER_NAME: gitUserName,
                GIT_COMMITTER_EMAIL: gitUserEmail
              }
            : {})
        },
        redact: redactSensitiveText,
        logLine: appendRawLog
      });
      threadId = res.threadId;
      finalResponse = res.finalResponse;
    }

    console.log('[agent] model exec completed', { taskId: task.id, provider: modelProvider, threadId });

    // Bind the thread ID to the task group for future resumption.
    if (threadId && taskGroupId) {
      await taskService.bindTaskGroupThreadId(taskGroupId, threadId);
    }

    // Post the result back to the provider after completion.
    let outputText = '';
    outputText = finalResponse || '';
    // try {
    //   // Optional: read from the provider output file (debugging parity with legacy Codex path).
    //   outputText = await readFile(path.join(repoDir, outputLastMessageFile), 'utf8');
    // } catch (err: any) {
    //   await appendLog(`Failed to read ${outputLastMessageFile}: ${err?.message || err}`);
    //   outputText = '';
    // }

    const safeOutputText = redactSensitiveText(outputText).trimEnd();
    const skipProviderPost = task.eventType === 'chat' || Boolean(payload?.__skipProviderPost);

    // Business context (Chat/manual trigger):
    // - Console "chat" tasks do not have a provider-side target (Issue/MR/Commit) to comment on.
    // - Change record: skip `postToProvider()` when `eventType=chat` or payload explicitly sets `__skipProviderPost`.
    if (skipProviderPost) {
      await appendLog('Provider posting skipped (chat/manual task)');
      return { logs, logsSeq, outputText: safeOutputText ? safeOutputText : undefined };
    }

    const details = buildGitlabLogDetails(logs);
    const parts = [safeOutputText].filter((v) => v.length > 0);
    if (details) parts.push(details);
    const body = parts.join('\n\n') || '(no output)';
    console.log('[agent] posting result to provider', { taskId: task.id });
    const posted = await postToProvider({
      provider: execution.provider,
      task,
      payload,
      body,
      gitlab: execution.gitlab,
      github: execution.github
    });
    console.log('[agent] posted result to provider', { taskId: task.id, commentUrl: posted?.url });
    if (posted?.url) {
      await appendLog(`Posted successfully: ${posted.url}`);
    } else {
      await appendLog('Posted successfully');
    }

    return { logs, logsSeq, providerCommentUrl: posted?.url, outputText: safeOutputText ? safeOutputText : undefined };
  } catch (err: any) {
    const payload: any = task.payload ?? {};
    const consoleUrl = getTaskConsoleUrl(task.id);
    const details = buildGitlabLogDetails(logs);
    const failureBodyParts = [
      `Task execution failed; see HookCode console: ${consoleUrl}`,
      details
    ].filter((v) => v && v.trim().length);

    let providerCommentUrl: string | undefined;
    const skipProviderPost = task.eventType === 'chat' || Boolean(payload?.__skipProviderPost);
    if (!skipProviderPost) {
      try {
        const fallbackProvider: RepoProvider = execution?.provider ?? task.repoProvider ?? 'gitlab';
        const gitlab = execution?.gitlab ?? (fallbackProvider === 'gitlab' ? new GitlabService() : undefined);
        const github = execution?.github ?? (fallbackProvider === 'github' ? new GithubService() : undefined);

        const posted = await postToProvider({
          provider: fallbackProvider,
          task,
          payload,
          body: failureBodyParts.join('\n\n'),
          gitlab,
          github
        });
        providerCommentUrl = posted?.url;
        if (providerCommentUrl) {
          await appendLog(`Posted successfully: ${providerCommentUrl}`);
        } else {
          await appendLog('Posted successfully');
        }
      } catch (postErr: any) {
        await appendLog(`Post failed: ${postErr?.message || postErr}`);
      }
    } else {
      await appendLog('Provider posting skipped (chat/manual task)');
    }

    const safeMessage = redactSensitiveText(err?.message || String(err));
    throw new AgentExecutionError(safeMessage, { logs, logsSeq, providerCommentUrl, cause: err });
  }
}

export { callAgent };

async function streamCommand(
  command: string,
  log: (msg: string) => Promise<void>,
  options: StreamOptions = {}
): Promise<void> {
  // All external commands (git/codex) in `callAgent()` go through this function: split stdout/stderr by line and write into task logs.
  const redact = options.redact ?? redactSensitiveText;
  await new Promise<void>((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let chain = Promise.resolve();
    const enqueue = (line: string) => {
      chain = chain.then(() => log(redact(line))).catch((err) => {
        console.error('[streamCommand] log failed', err);
      });
    };

    const createLineBuffer = () => {
      let buffer = '';
      return {
        push: (data: Buffer) => {
          buffer += data.toString();
          let idx = buffer.indexOf('\n');
          while (idx !== -1) {
            const rawLine = buffer.slice(0, idx).replace(/\r$/, '');
            buffer = buffer.slice(idx + 1);
            enqueue(rawLine);
            idx = buffer.indexOf('\n');
          }
        },
        flush: () => {
          if (!buffer) return;
          enqueue(buffer.replace(/\r$/, ''));
          buffer = '';
        }
      };
    };

    const stdoutBuffer = createLineBuffer();
    const stderrBuffer = createLineBuffer();

    child.stdout.on('data', (data: Buffer) => stdoutBuffer.push(data));
    child.stderr.on('data', (data: Buffer) => stderrBuffer.push(data));

    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', async (code) => {
      stdoutBuffer.flush();
      stderrBuffer.flush();

      if (code === 0) {
        await chain;
        resolve();
      } else {
        enqueue(`[exit ${code}] ${command}`);
        await chain;
        reject(new Error(`command failed with code ${code}`));
      }
    });
  });
}

interface StreamOptions {
  env?: Record<string, string | undefined>;
  redact?: (text: string) => string;
}
