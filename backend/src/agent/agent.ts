import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile, stat, readFile, chmod, rename, copyFile, cp, readdir } from 'fs/promises';
import path from 'path';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Task, TaskGitStatusSnapshot, TaskGitStatusWorkingTree, TaskResult } from '../types/task';
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
import type { UserApiTokenService } from '../modules/users/user-api-token.service';
import { hasPatScope } from '../modules/auth/patScopes';
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
// Reuse a shared console URL builder so provider messages consistently link back to the task detail page. docs/en/developer/plans/taskdetailbacklink20260122k4p8/task_plan.md taskdetailbacklink20260122k4p8
import { getTaskConsoleUrl } from '../utils/taskConsoleUrl';
// Build repo-external task output paths to avoid polluting working directories. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
import { buildTaskOutputFilePath } from '../utils/taskOutputPath';
// Keep git workflow helpers and config keys centralized for hook guard logic. docs/en/developer/plans/gitcfgfix20260123/task_plan.md gitcfgfix20260123
import { canTokenPushToUpstream, GIT_CONFIG_KEYS, normalizeGitRemoteUrl, toRepoWebUrl } from '../utils/gitWorkflow';
import { ensureGithubForkRepo, ensureGitlabForkProject, resolveRepoWorkflowMode } from '../services/repoWorkflowMode';
// Pull git status helpers to report repo changes after write-enabled runs. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
import { buildWorkingTree, computeGitPushState, computeGitStatusDelta, parseAheadBehind } from '../utils/gitStatus';
import { installDependencies, DependencyInstallerError } from './dependencyInstaller';
import { RuntimeService } from '../services/runtimeService';
import { HookcodeConfigService } from '../services/hookcodeConfigService';
import type { DependencyResult, HookcodeConfig, RobotDependencyConfig } from '../types/dependency';

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
const resolveBuildRoot = (): string => {
  // Prefer explicit or repo-root build directories to keep API/worker workspace paths aligned. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const explicit = (process.env.HOOKCODE_BUILD_ROOT ?? '').trim();
  if (explicit && existsSync(explicit)) return explicit;
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'backend', 'src', 'agent', 'build'),
    path.join(cwd, 'src', 'agent', 'build')
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, 'build');
};

// Resolve the build root deterministically to prevent preview workspace mismatches. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
// Export agent workspace root for shared git operations. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const BUILD_ROOT = resolveBuildRoot();
// Centralize task-group workspace root so each group maps to a single checkout. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
export const TASK_GROUP_WORKSPACE_ROOT = path.join(BUILD_ROOT, 'task-groups');
const MAX_LOG_LINES = 1000;

let taskService: TaskService;
let taskLogStream: TaskLogStream;
let repositoryService: RepositoryService;
let repoRobotService: RepoRobotService;
let userService: UserService;
let userApiTokenService: UserApiTokenService;
let runtimeService: RuntimeService;
let hookcodeConfigService: HookcodeConfigService;

export const setAgentServices = (services: {
  taskService: TaskService;
  taskLogStream: TaskLogStream;
  repositoryService: RepositoryService;
  repoRobotService: RepoRobotService;
  userService: UserService;
  userApiTokenService: UserApiTokenService;
  runtimeService: RuntimeService;
  hookcodeConfigService: HookcodeConfigService;
}) => {
  // Inject runtime/config services so dependency installs run inside the agent. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  taskService = services.taskService;
  taskLogStream = services.taskLogStream;
  repositoryService = services.repositoryService;
  repoRobotService = services.repoRobotService;
  userService = services.userService;
  userApiTokenService = services.userApiTokenService;
  runtimeService = services.runtimeService;
  hookcodeConfigService = services.hookcodeConfigService;
};

const assertAgentServicesReady = () => {
  if (
    !taskService ||
    !taskLogStream ||
    !repositoryService ||
    !repoRobotService ||
    !userService ||
    !userApiTokenService ||
    !runtimeService ||
    !hookcodeConfigService
  ) {
    throw new Error('[agent] services are not initialized (missing setAgentServices call)');
  }
};

const formatRef = (ref?: string) => ref?.replace(/^refs\/heads\//, '');
const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeRobotDependencyConfig = (value: unknown): RobotDependencyConfig | null => {
  // Normalize robot dependency overrides to a safe, typed shape. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : undefined;
  const allowCustomInstall = typeof raw.allowCustomInstall === 'boolean' ? raw.allowCustomInstall : undefined;
  const failureModeRaw = typeof raw.failureMode === 'string' ? raw.failureMode.trim().toLowerCase() : '';
  const failureMode = failureModeRaw === 'soft' || failureModeRaw === 'hard' ? failureModeRaw : undefined;
  return { enabled, allowCustomInstall, failureMode };
};

// Provide package hints for custom runtime Docker images. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
const INSTALL_HINTS: Record<string, string> = {
  python: 'python3 py3-pip',
  java: 'openjdk17-jre maven',
  ruby: 'ruby ruby-bundler',
  go: 'go',
  node: 'nodejs npm'
};

const buildRuntimeMissingMessage = (language: string): string => {
  // Provide actionable guidance when a required runtime is missing. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const hint = INSTALL_HINTS[language] ?? language;
  return [
    `Runtime "${language}" is required but not installed.`,
    '',
    'To add runtime support, build a custom Docker image:',
    '',
    '1. Create backend/Dockerfile.custom:',
    '   FROM node:18-alpine',
    `   RUN apk add --no-cache ${hint}`,
    '',
    '2. Update docker/docker-compose.yml to use backend/Dockerfile.custom.',
    '',
    'See docs: /docs/en/user-docs/custom-dockerfile'
  ].join('\n');
};

const sanitizeRepoFolderName = (raw: string): string => {
  // Ensure task-group repo subfolder names are stable and filesystem-safe. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const cleaned = raw.replace(/[\\/]/g, '_').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'repo';
  return cleaned;
};

const deriveRepoFolderName = (repoSlug: string): string => {
  // Derive the repo folder name from the slug tail (org__repo → repo). docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const normalized = safeTrim(repoSlug);
  if (!normalized) return 'repo';
  const segments = normalized.split('__').filter(Boolean);
  const tail = segments.length > 0 ? segments[segments.length - 1] : normalized;
  return sanitizeRepoFolderName(tail);
};

// Map task-group ids to workspace roots for shared artifacts. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
export const buildTaskGroupRootDir = (params: { taskGroupId?: string | null; taskId: string }): string => {
  const workspaceKey = safeTrim(params.taskGroupId) || safeTrim(params.taskId) || 'task';
  return path.join(TASK_GROUP_WORKSPACE_ROOT, workspaceKey);
};

// Build task-group repo paths under the task-group root with a taskId fallback. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
export const buildTaskGroupWorkspaceDir = (params: {
  taskGroupId?: string | null;
  taskId: string;
  provider: RepoProvider;
  repoSlug: string;
}): string => {
  const rootDir = buildTaskGroupRootDir({ taskGroupId: params.taskGroupId, taskId: params.taskId });
  const repoFolder = deriveRepoFolderName(params.repoSlug);
  return path.join(rootDir, repoFolder);
};

// Define the default Codex output schema with result text + next actions for frontend suggestions. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
const DEFAULT_CODEX_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    output: { type: 'string', description: 'Primary assistant output (markdown).' },
    next_actions: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
      description: 'Three suggested next actions for the user to run next.'
    }
  },
  required: ['output', 'next_actions'],
  additionalProperties: false
} as const;

// Persist the default Codex schema as JSON so task-group workspaces always have a usable baseline. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
const DEFAULT_CODEX_SCHEMA_CONTENTS = `${JSON.stringify(DEFAULT_CODEX_OUTPUT_SCHEMA, null, 2)}\n`;

const buildCodexSchemaContents = (): string => {
  // Provide a stable default codex-schema.json payload for task-group initialization. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  return DEFAULT_CODEX_SCHEMA_CONTENTS;
};

const ensurePlaceholderFile = async (filePath: string, contents: string): Promise<void> => {
  // Create task-group placeholder files only when missing to preserve user edits. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  try {
    await stat(filePath);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
    await writeFile(filePath, contents, 'utf8');
  }
};

const readCodexOutputSchema = async (params: {
  taskGroupDir: string;
  appendLog: (line: string) => Promise<void>;
}): Promise<unknown | undefined> => {
  // Load codex-schema.json for TurnOptions.outputSchema without breaking runs on invalid JSON. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const schemaPath = path.join(params.taskGroupDir, 'codex-schema.json');
  try {
    const raw = await readFile(schemaPath, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      await params.appendLog('codex-schema.json must be a JSON object; skipping outputSchema.');
      return undefined;
    }
    // Log successful codex-schema loads for structured-output troubleshooting. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    await params.appendLog('Loaded codex-schema.json for outputSchema from task-group root.');
    return parsed;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return undefined;
    await params.appendLog(`Failed to parse codex-schema.json; skipping outputSchema: ${err?.message || err}`);
    return undefined;
  }
};

const resolveAgentExampleCodexDir = (): string | null => {
  // Locate the bundled .codex template from the agent example workspace. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'backend', 'src', 'agent', 'example', '.codex'),
    path.join(cwd, 'src', 'agent', 'example', '.codex'),
    path.join(__dirname, 'example', '.codex')
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

const ensureTaskGroupCodexDir = async (taskGroupDir: string): Promise<void> => {
  // Seed task-group .codex folders from the example template when available. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const destination = path.join(taskGroupDir, '.codex');
  if (!existsSync(destination)) {
    const template = resolveAgentExampleCodexDir();
    if (template) {
      await cp(template, destination, { recursive: true });
    } else {
      await mkdir(destination, { recursive: true });
    }
  }
  await mkdir(path.join(destination, 'skills'), { recursive: true });
};

const writeFileIfChanged = async (filePath: string, contents: string): Promise<void> => {
  // Keep generated task-group files in sync without clobbering identical content. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  try {
    const existing = await readFile(filePath, 'utf8');
    if (existing === contents) return;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  await writeFile(filePath, contents, 'utf8');
};

const normalizeHostBaseUrl = (raw: string): string => {
  // Normalize API base URLs to host roots for task-group env generation. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return trimmed.replace(/\/+$/, '').replace(/\/api$/i, '');
  }
};

const resolveTaskGroupApiBaseUrl = (): string => {
  // Derive the backend host root from runtime server config. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const explicit = normalizeHostBaseUrl(
    safeTrim(process.env.HOOKCODE_API_BASE_URL) ||
      safeTrim(process.env.OPENAPI_BASE_URL) ||
      safeTrim(process.env.ADMIN_TOOLS_API_BASE_URL)
  );
  if (explicit) return explicit;
  const host = safeTrim(process.env.HOST) || '127.0.0.1';
  const port = Number(process.env.PORT) || 4000;
  return `http://${host}:${port}`;
};

// Expose API base URL resolution for unit coverage. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
export const __test__resolveTaskGroupApiBaseUrl = resolveTaskGroupApiBaseUrl;
// Expose codex-schema defaults/parsing for unit coverage. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
export const __test__buildCodexSchemaContents = buildCodexSchemaContents;
export const __test__readCodexOutputSchema = readCodexOutputSchema;

const parseEnvContent = (content: string): Record<string, string> => {
  // Parse simple KEY=VALUE env content to reuse PATs when present. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const values: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const raw = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
    const idx = raw.indexOf('=');
    if (idx === -1) continue;
    const key = raw.slice(0, idx).trim();
    let value = raw.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) values[key] = value;
  }
  return values;
};

const readEnvFileValues = async (filePath: string): Promise<Record<string, string>> => {
  try {
    const content = await readFile(filePath, 'utf8');
    return parseEnvContent(content);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    throw err;
  }
};

const listSkillDirectories = async (skillsRoot: string): Promise<string[]> => {
  // Collect top-level skill directories for env sync under task-group .codex. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  try {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(skillsRoot, entry.name));
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
};

const syncTaskGroupSkillEnvFiles = async (params: { taskGroupDir: string; envContents: string }): Promise<void> => {
  // Duplicate the task-group .env into each skill folder for consistent API access. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const skillsRoot = path.join(params.taskGroupDir, '.codex', 'skills');
  const skillDirs = await listSkillDirectories(skillsRoot);
  for (const skillDir of skillDirs) {
    await writeFileIfChanged(path.join(skillDir, '.env'), params.envContents);
  }
};

// Expose skill env syncing for unit coverage. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
export const __test__syncTaskGroupSkillEnvFiles = syncTaskGroupSkillEnvFiles;

const resolvePatOwnerUserId = async (): Promise<string> => {
  // Select a user account to own the auto-issued PAT (default to first user). docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const existing = await userService.getDefaultUserCredentialsRaw();
  if (existing?.userId) return existing.userId;
  await userService.ensureBootstrapUser();
  const fallback = await userService.getDefaultUserCredentialsRaw();
  if (fallback?.userId) return fallback.userId;
  throw new Error('No users available to issue a PAT');
};

const ensureTaskGroupPat = async (params: { taskGroupId: string; existingPat?: string }): Promise<string> => {
  // Reuse a valid PAT from the task-group .env or issue a new one via UserApiTokenService. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const existing = safeTrim(params.existingPat);
  if (existing) {
    const verified = await userApiTokenService.verifyToken(existing);
    if (verified && hasPatScope(verified.auth.scopes, 'tasks', 'write')) return existing;
  }
  const ownerId = await resolvePatOwnerUserId();
  const name = `task-group-${params.taskGroupId}`;
  const result = await userApiTokenService.createToken(ownerId, {
    name,
    // Require tasks:write so task-group PATs can call preview highlight APIs. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    scopes: [{ group: 'tasks', level: 'write' }],
    expiresInDays: 0
  });
  return result.token;
};

// Expose PAT reuse/rotation logic for unit coverage. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
export const __test__ensureTaskGroupPat = ensureTaskGroupPat;

const resolveTaskGroupEnvValues = async (params: { taskGroupId: string; existingPat?: string }) => {
  // Build task-group env values from runtime API base + auto-issued PAT. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const taskGroupId = safeTrim(params.taskGroupId);
  if (!taskGroupId) throw new Error('taskGroupId is required to build task-group .env');
  const apiBaseUrl = resolveTaskGroupApiBaseUrl();
  const pat = await ensureTaskGroupPat({ taskGroupId, existingPat: params.existingPat });
  return { apiBaseUrl, pat, taskGroupId };
};

export const buildTaskGroupEnvFileContents = (params: { apiBaseUrl: string; pat: string; taskGroupId: string }): string => {
  // Emit the task-group .env contents with explicit API + PAT settings. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  return [
    '# Provide base URL and PAT values for task-group API access.',
    '# Backend API base URL (e.g. https://hookcode.example.com)',
    `HOOKCODE_API_BASE_URL=${params.apiBaseUrl}`,
    '# Personal access token (PAT) for Authorization: Bearer <PAT>',
    `HOOKCODE_PAT=${params.pat}`,
    '# Task group id for scoping API requests.',
    `HOOKCODE_TASK_GROUP_ID=${params.taskGroupId}`,
    ''
  ].join('\n');
};

export const buildTaskGroupAgentsContent = (params: { envFileContents: string; repoFolderName: string }): string => {
  // Provide a fixed task-group AGENTS template and embed the .env content verbatim. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const repoFolder = safeTrim(params.repoFolderName) || 'repo';
  const repoLabel = `<<${repoFolder}>>`;
  // Add target URL guidance with route matching rules for auto-navigating previews. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  return [
    '# Task Group Workspace Rules',
    '',
    `Your working directory is the git-cloned repository folder named ${repoLabel} for this task group.`,
    `Operate only inside the git-cloned repository folder ${repoLabel} for this task group.`,
    `Do not modify files outside ${repoLabel} up to the task-group root.`,
    '',
    'If a skill requires HookCode API access, use the following .env configuration:',
    'Use a long-lived PAT (no expiry preferred) for this workspace.',
    '',
    '## Planning with Files',
    '',
    '<IMPORTANT>',
    'MANDATORY: Must use planning-with-files skill for all tasks:',
    '1. First scan the session directory ( Current directory ) to check if planning files exist',
    '2. If files exist: Continue working with existing task_plan.md, findings.md, progress.md',
    '3. If files do not exist:',
    '   a. Read skill: `.codex/skills/planning-with-files/SKILL.md`',
    '   b. Create task_plan.md, findings.md, progress.md in the session directory',
    '4. Follow 3-file pattern throughout the task',
    '</IMPORTANT>',
    '',
    '## Web Project Modifications',
    '',
    '<IMPORTANT>',
    'When modifying web project content (frontend or any preview-enabled project):',
    '1. Use hookcode-preview-highlight skill to show users what was changed',
    '2. Read skill: `.codex/skills/hookcode-preview-highlight/SKILL.md`',
    '3. After making changes, highlight the modified DOM elements:',
    '   - Send highlight commands with specific CSS selectors',
    '   - Include bubble tooltips explaining what was changed',
    '   - Use appropriate colors (e.g., blue for additions, yellow for modifications)',
    '4. If changes apply to a specific route, include `targetUrl` (supports :param/*/**/|| patterns) so the preview can auto-navigate or confirm the current route (users may lock auto-navigation).',
    '5. Inform users about the exact location of changes in the UI',
    '</IMPORTANT>',
    '',
    '```env',
    params.envFileContents,
    '```',
    ''
  ].join('\n');
};

const ensureTaskGroupLayout = async (params: {
  taskGroupDir: string;
  taskGroupId: string;
  repoFolderName: string;
}): Promise<void> => {
  // Initialize the task-group root with required placeholders and env/agent templates. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  await mkdir(params.taskGroupDir, { recursive: true });
  await ensureTaskGroupCodexDir(params.taskGroupDir);
  // Seed codex-schema.json with the default structured output schema used by Codex runs. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  await ensurePlaceholderFile(path.join(params.taskGroupDir, 'codex-schema.json'), buildCodexSchemaContents());
  const existingEnv = await readEnvFileValues(path.join(params.taskGroupDir, '.env'));
  const envValues = await resolveTaskGroupEnvValues({
    taskGroupId: params.taskGroupId,
    existingPat: existingEnv.HOOKCODE_PAT
  });
  const envContents = buildTaskGroupEnvFileContents(envValues);
  await writeFileIfChanged(path.join(params.taskGroupDir, '.env'), envContents);
  const agentsContents = buildTaskGroupAgentsContent({
    envFileContents: envContents,
    repoFolderName: params.repoFolderName
  });
  await writeFileIfChanged(path.join(params.taskGroupDir, 'AGENTS.override.md'), agentsContents);
  await syncTaskGroupSkillEnvFiles({ taskGroupDir: params.taskGroupDir, envContents });
};

const moveTaskOutputToGroupRoot = async (params: {
  taskGroupDir: string;
  fileName: string;
  sourcePath: string;
  appendLog: (line: string) => Promise<void>;
}): Promise<void> => {
  // Ensure provider output files land in the task-group root after execution. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const destination = path.join(params.taskGroupDir, params.fileName);
  if (path.resolve(destination) === path.resolve(params.sourcePath)) return;
  try {
    await rm(destination, { force: true });
    await rename(params.sourcePath, destination);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return;
    if (err?.code === 'EXDEV') {
      await copyFile(params.sourcePath, destination);
      await rm(params.sourcePath, { force: true });
      return;
    }
    await params.appendLog(`Failed to move output file to task-group root: ${err?.message || err}`);
  }
};

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
// Export shell-escape helper for shared git commands. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const shDoubleQuote = (value: string) =>
  `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')}"`;

/**
 * Build git proxy flags from GIT_HTTP_PROXY env var.
 * Returns `-c http.proxy=<proxy> -c https.proxy=<proxy>` if set, otherwise empty string.
 * gitproxyfix20260127
 */
export const buildGitProxyFlags = (): string => {
  const proxy = (process.env.GIT_HTTP_PROXY ?? '').trim();
  if (!proxy) return '';
  return `-c http.proxy=${shDoubleQuote(proxy)} -c https.proxy=${shDoubleQuote(proxy)}`;
};

/**
 * Configure repo-local git proxy settings to override user's global ~/.gitconfig.
 *
 * Problem: User's ~/.gitconfig may have http.proxy=127.0.0.1:7890 which is unreachable
 * from Codex/Claude sandbox. When the model executes `git push`, it reads ~/.gitconfig
 * and fails because 127.0.0.1 inside sandbox points to sandbox itself, not host machine.
 *
 * Solution: Set repo-local git config (in .git/config) which has higher priority than
 * ~/.gitconfig. This ensures all git commands in the repo use the correct proxy.
 *
 * docs/en/developer/plans/gitproxyfix20260127/task_plan.md gitproxyfix20260127
 */
export const configureRepoLocalGitProxy = async (repoDir: string): Promise<void> => {
  const proxy = (process.env.GIT_HTTP_PROXY ?? '').trim();
  if (!proxy) return;

  // Set repo-local http.proxy and https.proxy to override ~/.gitconfig settings.
  // Repo-local config (.git/config) has higher priority than user global (~/.gitconfig).
  // gitproxyfix20260127
  const { execSync } = await import('child_process');
  try {
    execSync(`git config --local http.proxy ${shDoubleQuote(proxy)}`, { cwd: repoDir, stdio: 'pipe' });
    execSync(`git config --local https.proxy ${shDoubleQuote(proxy)}`, { cwd: repoDir, stdio: 'pipe' });
  } catch (err) {
    // Best-effort: log warning but don't fail the task if proxy config fails
    console.warn('[agent] Failed to configure repo-local git proxy:', err);
  }
};

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

// Export checkout ref resolution so push actions reuse task branch selection. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const resolveCheckoutRef = (params: {
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

// Export git auth injection helper for push flows. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const injectBasicAuth = (
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

// Export repo URL helper for git push actions. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const getRepoCloneUrl = (provider: RepoProvider, payload: any): string | undefined => {
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

// Export repo slug helper to align workspace paths across actions. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const getRepoSlug = (provider: RepoProvider, payload: any, fallback: string): string => {
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
  readonly aborted?: boolean; // Flag abort-driven exits for pause/stop handling. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  // Attach git status snapshot for failed tasks to preserve change tracking. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  readonly gitStatus?: TaskResult['gitStatus'];

  constructor(
    message: string,
    params: {
      logs: string[];
      logsSeq: number;
      providerCommentUrl?: string;
      gitStatus?: TaskResult['gitStatus'];
      cause?: unknown;
      aborted?: boolean;
    }
  ) {
    super(message);
    this.name = 'AgentExecutionError';
    this.logs = params.logs;
    this.logsSeq = params.logsSeq;
    this.providerCommentUrl = params.providerCommentUrl;
    this.aborted = params.aborted;
    this.gitStatus = params.gitStatus;
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

// Export execution resolver for shared push flows. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const resolveExecution = async (
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

// Return git status alongside logs so downstream services can persist change tracking. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
async function callAgent(
  task: Task,
  options?: { signal?: AbortSignal }
): Promise<{ logs: string[]; logsSeq: number; providerCommentUrl?: string; outputText?: string; gitStatus?: TaskResult['gitStatus'] }> {
  assertAgentServicesReady();

  const logs: string[] = [];
  let logsSeq = 0;
  let execution: ResolvedExecution | null = null;
  let tokenUsage: TaskTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let repoWorkflow: TaskResult['repoWorkflow'] | undefined; // Surface direct-vs-fork workflow to UI/logs. 24yz61mdik7tqdgaa152
  // Track git status snapshots for write-enabled runs. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  let gitStatus: TaskResult['gitStatus'] | undefined;
  let gitBaseline: TaskGitStatusSnapshot | undefined;
  // Store repo workspace path for post-run git status capture, even on failure. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  let repoDir = '';
  const taskLogsDbEnabled = isTaskLogsDbEnabled(); // Persist task logs based on DB toggle even when user visibility is disabled. nykx5svtlgh050cstyht
  let taskGroupId: string | null = typeof task.groupId === 'string' ? task.groupId.trim() : null;
  let threadIdBound = false;
  // Track whether this run is allowed to mutate repos before collecting git status. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  let writeEnabled = false;
  // Honor pause/stop signals from the task runner. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  const abortSignal = options?.signal;

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

  const appendThoughtChainLine = async (payload: Record<string, unknown>) => {
    // Emit structured JSONL log entries for ThoughtChain rendering. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    await appendLine(JSON.stringify(payload));
  };

  const appendThoughtChainCommand = async (params: {
    id: string;
    status: 'started' | 'completed' | 'failed';
    command: string;
    output?: string;
    exitCode?: number | null;
  }) => {
    // Normalize git workspace logs into command_execution items for the UI timeline. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    const status = params.status === 'started' ? 'in_progress' : params.status;
    const type = params.status === 'started' ? 'item.started' : 'item.completed';
    await appendThoughtChainLine({
      type,
      item: {
        id: params.id,
        type: 'command_execution',
        status,
        command: redactSensitiveText(params.command),
        aggregated_output: params.output ? redactSensitiveText(params.output) : undefined,
        exit_code: typeof params.exitCode === 'number' ? params.exitCode : undefined
      }
    });
  };

  const finalizeGitStatus = (finalCapture: {
    snapshot?: TaskGitStatusSnapshot;
    workingTree?: TaskGitStatusWorkingTree;
    pushTargetSha?: string;
    errors: string[];
  }) => {
    // Normalize final git status data for downstream persistence and UI. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const finalSnapshot = finalCapture.snapshot;
    if (!gitStatus) gitStatus = { enabled: true, capturedAt: new Date().toISOString(), errors: [] };
    gitStatus.capturedAt = new Date().toISOString();
    if (finalSnapshot) gitStatus.final = finalSnapshot;
    if (finalCapture.workingTree) gitStatus.workingTree = finalCapture.workingTree;
    gitStatus.delta = computeGitStatusDelta(gitBaseline, finalSnapshot) ?? undefined;
    // Derive push error signals so UI can distinguish unknown vs failed push checks. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    const pushError = finalCapture.errors.find((err) => err.startsWith('pushTarget:') || err.startsWith('pushRemote:'));
    const pushState = computeGitPushState({
      delta: gitStatus.delta ?? null,
      final: finalSnapshot,
      pushTargetSha: finalCapture.pushTargetSha,
      error: pushError
    });
    gitStatus.push = {
      ...pushState,
      targetBranch: finalSnapshot?.branch || undefined,
      targetWebUrl: finalSnapshot?.pushWebUrl || undefined,
      targetHeadSha: finalCapture.pushTargetSha
    };
    if (finalCapture.errors.length) {
      if (!gitStatus.errors) gitStatus.errors = [];
      gitStatus.errors.push(...finalCapture.errors);
    }
  };

  try {
    const payload: any = task.payload ?? {};
    if (!taskGroupId) {
      taskGroupId = await taskService.ensureTaskGroupId(task);
    }
    // Only resume model threads when the task group already has prior tasks. docs/en/developer/plans/taskgroup-resume-thread-20260203/task_plan.md taskgroup-resume-thread-20260203
    let hasPriorTaskGroupTask = false;
    let resumeThreadId: string | null = null;
    if (taskGroupId) {
      try {
        hasPriorTaskGroupTask = await taskService.hasPriorTaskGroupTask(taskGroupId, task.id);
      } catch (err: any) {
        console.warn('[agent] failed to check task group history for resume (continuing)', err);
      }
      if (hasPriorTaskGroupTask) {
        resumeThreadId = await taskService.getTaskGroupThreadId(taskGroupId);
      }
    }
    execution = await resolveExecution(task, payload, appendLog);
    // Flag write-enabled runs for git change tracking. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    writeEnabled = execution.robot.permission === 'write';

    const repoUrl: string | undefined = getRepoCloneUrl(execution.provider, payload);
    const repoSlug = getRepoSlug(execution.provider, payload, task.id);
    const checkout = resolveCheckoutRef({
      task,
      payload,
      repo: execution.repo,
      robot: execution.robot
    });
    const checkoutRef = checkout.ref;
    // Keep repoDir in outer scope so failure handlers can still inspect git state. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    // Bind task-group artifacts to a stable root directory for shared execution context. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const taskGroupDir = buildTaskGroupRootDir({ taskGroupId, taskId: task.id });
    // Bind the workspace to task group ids so each group has a dedicated repo checkout. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    // Capture the repo folder name for AGENTS guidance output. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const repoFolderName = deriveRepoFolderName(repoSlug);
    repoDir = buildTaskGroupWorkspaceDir({ taskGroupId, taskId: task.id, provider: execution.provider, repoSlug });

    if (!repoUrl) {
      await appendLog('Repository URL not found; cannot proceed');
      throw new Error('missing repo url');
    }

    // Ensure the task-group root layout exists before clone/pull operations. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    await ensureTaskGroupLayout({
      taskGroupDir,
      taskGroupId: safeTrim(taskGroupId) || task.id,
      repoFolderName
    });

    await appendLog(`Preparing work directory ${repoDir}`);
    if (checkoutRef) {
      await appendLog(`This task will check out branch: ${checkoutRef} (source: ${checkout.source})`);
    } else {
      await appendLog('No checkout branch specified; using the repository default branch');
    }
    // Treat task-group workspaces as ready only when a .git directory exists to avoid partial clones. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    const workspaceLabel = taskGroupId ? `task group ${taskGroupId}` : `task ${task.id}`;
    const workspaceItemId = `task_group_workspace_${taskGroupId ?? task.id}`;
    const gitDir = path.join(repoDir, '.git');
    let workspaceReady = false;
    let repoDirExists = false;
    try {
      await stat(repoDir);
      repoDirExists = true;
    } catch (_) {
      repoDirExists = false;
    }
    if (repoDirExists) {
      try {
        await stat(gitDir);
        workspaceReady = true;
      } catch (_) {
        workspaceReady = false;
      }
    }
    if (repoDirExists && !workspaceReady) {
      await appendLog('Workspace directory exists without git metadata; recreating workspace');
      await rm(repoDir, { recursive: true, force: true });
    }
    let hasTaskGroupLogs = false;
    if (taskGroupId && !workspaceReady) {
      try {
        hasTaskGroupLogs = await taskService.hasTaskGroupLogs(taskGroupId);
      } catch (err: any) {
        console.warn('[agent] failed to check task group logs (continuing)', err);
      }
      if (hasTaskGroupLogs) {
        await appendLog(
          'Existing task-group logs were found, but this worker has no workspace for the group. A new environment will be used for execution due to the environment change.'
        );
      }
    }
    // Reuse the previously computed task-group history check for workspace decisions. docs/en/developer/plans/taskgroup-resume-thread-20260203/task_plan.md taskgroup-resume-thread-20260203
    const reuseWorkspace = workspaceReady && hasPriorTaskGroupTask;
    // Only allow git network sync when the task-group workspace is initialized on this worker. docs/en/developer/plans/taskgroup-worker-env-20260203/task_plan.md taskgroup-worker-env-20260203
    const allowNetworkPull = !reuseWorkspace;

    // Build git proxy flags from GIT_HTTP_PROXY env var for network operations. gitproxyfix20260127
    const gitProxyFlags = buildGitProxyFlags();

    const cloneRepo = async () => {
      const injected = upstreamInjected;

      if (checkoutRef) {
        try {
          await appendLog(`Cloning repository (branch ${checkoutRef}) ${injected.displayUrl}`);
          // Use gitProxyFlags to pass proxy config to git commands. gitproxyfix20260127
          await streamCommand(
            `git ${gitProxyFlags} clone --branch ${shDoubleQuote(checkoutRef)} ${shDoubleQuote(injected.execUrl)} ${shDoubleQuote(repoDir)}`,
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
      // Use gitProxyFlags to pass proxy config to git commands. gitproxyfix20260127
      await streamCommand(
        `git ${gitProxyFlags} clone ${shDoubleQuote(injected.execUrl)} ${shDoubleQuote(repoDir)}`,
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

    // Emit a ThoughtChain command entry for task-group repo preparation. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    if (!workspaceReady) {
      const cloneCommand = `git clone ${upstreamInjected.displayUrl} ${repoDir} (${workspaceLabel})`;
      await appendThoughtChainCommand({ id: workspaceItemId, status: 'started', command: cloneCommand });
      try {
        await cloneRepo();
        // Configure repo-local git proxy to override ~/.gitconfig (e.g., 127.0.0.1 → LAN IP).
        // This ensures model-executed git commands use the correct proxy. gitproxyfix20260127
        await configureRepoLocalGitProxy(repoDir);
        await appendThoughtChainCommand({ id: workspaceItemId, status: 'completed', command: cloneCommand });
      } catch (err: any) {
        await appendThoughtChainCommand({
          id: workspaceItemId,
          status: 'failed',
          command: cloneCommand,
          output: err?.message || String(err)
        });
        throw err;
      }
    } else {
      // Keep workspace reuse logs aligned with whether network pulls are skipped on this worker. docs/en/developer/plans/taskgroup-worker-env-20260203/task_plan.md taskgroup-worker-env-20260203
      const reuseCommand = reuseWorkspace
        ? `Reuse task group workspace (skip git pull): ${repoDir} (${workspaceLabel})`
        : `Reuse task group workspace: ${repoDir} (${workspaceLabel})`;
      await appendThoughtChainCommand({
        id: workspaceItemId,
        status: 'completed',
        command: reuseCommand
      });
    }

    if (checkoutRef) {
      try {
        await appendLog(`Checking out branch ${checkoutRef}`);
        await streamCommand(`cd ${repoDir} && git checkout ${shDoubleQuote(checkoutRef)}`, appendRawLog, {
          env: { GIT_TERMINAL_PROMPT: '0' },
          redact: redactSensitiveText
        });
        if (allowNetworkPull) {
          // Use gitProxyFlags to pass proxy config to git pull. gitproxyfix20260127
          await streamCommand(
            `cd ${repoDir} && git ${gitProxyFlags} pull --no-rebase origin ${shDoubleQuote(checkoutRef)}`,
            appendRawLog,
            {
              env: { GIT_TERMINAL_PROMPT: '0' },
              redact: redactSensitiveText
            }
          );
        } else {
          // Keep logs explicit when skipping network pulls for existing task-group workspaces. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
          await appendLog(`Skipping git pull for existing ${workspaceLabel} workspace`);
        }
      } catch (err: any) {
        await appendLog(`Checkout/pull failed: ${err.message || err}`);
      }
    } else if (allowNetworkPull) {
      try {
        await appendLog('Updating default branch');
        // Use gitProxyFlags to pass proxy config to git pull. gitproxyfix20260127
        await streamCommand(`cd ${repoDir} && git ${gitProxyFlags} pull --no-rebase`, appendRawLog, {
          env: { GIT_TERMINAL_PROMPT: '0' },
          redact: redactSensitiveText
        });
      } catch (err: any) {
        await appendLog(`Default branch update failed: ${err.message || err}`);
      }
    }

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const installGitPrePushGuard = async (params: { expectedUpstream: string; expectedPush: string }) => {
      // Install a repo-local guard and align git config keys with valid naming rules. docs/en/developer/plans/gitcfgfix20260123/task_plan.md gitcfgfix20260123
      const hookDir = path.join(repoDir, '.git', 'hooks');
      const hookPath = path.join(hookDir, 'pre-push');
      await mkdir(hookDir, { recursive: true });

      const script = `#!/bin/sh
# Guard pushes to ensure origin fetch/push targets stay correct for fork workflows. docs/en/developer/plans/gitcfgfix20260123/task_plan.md gitcfgfix20260123
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

expected_upstream="$(git config --get "${GIT_CONFIG_KEYS.upstream}" 2>/dev/null || true)"
expected_push="$(git config --get "${GIT_CONFIG_KEYS.push}" 2>/dev/null || true)"

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

      // Persist expected remotes under valid git config keys for the pre-push guard. docs/en/developer/plans/gitcfgfix20260123/task_plan.md gitcfgfix20260123
      const expectedUpstream = normalizeGitRemoteUrl(params.expectedUpstream);
      const expectedPush = normalizeGitRemoteUrl(params.expectedPush);
      await streamCommand(
        `cd ${repoDir} && git config --local ${shDoubleQuote(GIT_CONFIG_KEYS.upstream)} ${shDoubleQuote(expectedUpstream)} && git config --local ${shDoubleQuote(GIT_CONFIG_KEYS.push)} ${shDoubleQuote(expectedPush)}`,
        appendRawLog,
        { redact: redactSensitiveText }
      );
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

      const expectedUpstreamUrl = upstream.cloneUrl || repoUrl;
      // Resolve the robot-configured workflow mode (auto/direct/fork) for this run. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
      const workflowMode = resolveRepoWorkflowMode((execution!.robot as any)?.repoWorkflowMode);
      const writeEnabled = execution!.robot.permission === 'write';
      const upstreamCanPush = canTokenPushToUpstream(execution!.provider, execution!.robot.repoTokenRepoRole);

      // Always reset origin push URL first to avoid stale fork pushUrl when workflow changes. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
      await streamCommand(
        `cd ${repoDir} && git remote set-url --push origin ${shDoubleQuote(upstreamInjected.execUrl)}`,
        appendRawLog,
        { env: { GIT_TERMINAL_PROMPT: '0' }, redact: redactSensitiveText }
      );
      await installGitPrePushGuard({ expectedUpstream: expectedUpstreamUrl, expectedPush: expectedUpstreamUrl });

      if (workflowMode === 'direct') {
        // Respect explicit direct mode even when upstream push is unavailable. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
        await appendLog('Repo workflow mode: direct (skip fork setup)');
        await persistLogsBestEffort();
        return;
      }

      if (workflowMode === 'fork') {
        // Enforce explicit fork mode by creating/using a fork before push configuration. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        if (!writeEnabled) {
          await appendLog('Repo workflow mode: fork (read-only run, skipping push configuration)');
        }
        if (execution!.provider === 'github' && upstream.github) {
          const fork = await ensureGithubForkRepo({ github: execution!.github!, upstream: upstream.github, log: appendLog });
          const forkCloneUrl = safeTrim(fork?.cloneUrl);
          if (!fork || !forkCloneUrl) {
            throw new Error('fork workflow requested but fork repository clone URL is missing');
          }

          const forkInjected = injectBasicAuth(forkCloneUrl, auth);
          await streamCommand(
            `cd ${repoDir} && git remote set-url --push origin ${shDoubleQuote(forkInjected.execUrl)}`,
            appendRawLog,
            { env: { GIT_TERMINAL_PROMPT: '0' }, redact: redactSensitiveText }
          );
          await installGitPrePushGuard({ expectedUpstream: upstream.cloneUrl || repoUrl, expectedPush: forkCloneUrl });
          repoWorkflow = { mode: 'fork', provider: execution!.provider, upstream: upstream, fork: fork };
          await appendLog(`Repo workflow mode: fork (upstream=${upstream.slug ?? 'unknown'} fork=${fork.slug})`);
          await persistLogsBestEffort();
          return;
        }

        if (execution!.provider === 'gitlab' && upstream.gitlabProject) {
          const fork = await ensureGitlabForkProject({ gitlab: execution!.gitlab!, upstreamProject: upstream.gitlabProject, log: appendLog });
          const forkCloneUrl = safeTrim(fork?.cloneUrl) || (safeTrim(fork?.webUrl) ? `${safeTrim(fork?.webUrl)}.git` : '');
          if (!fork || !forkCloneUrl) {
            throw new Error('fork workflow requested but fork project clone URL is missing');
          }

          const forkInjected = injectBasicAuth(forkCloneUrl, auth);
          await streamCommand(
            `cd ${repoDir} && git remote set-url --push origin ${shDoubleQuote(forkInjected.execUrl)}`,
            appendRawLog,
            { env: { GIT_TERMINAL_PROMPT: '0' }, redact: redactSensitiveText }
          );
          await installGitPrePushGuard({ expectedUpstream: upstream.cloneUrl || repoUrl, expectedPush: forkCloneUrl });
          repoWorkflow = { mode: 'fork', provider: execution!.provider, upstream: upstream, fork: fork };
          await appendLog(`Repo workflow mode: fork (upstream=${upstream.slug ?? 'unknown'} fork=${fork.slug})`);
          await persistLogsBestEffort();
          return;
        }

        throw new Error(`fork workflow requested but provider ${execution!.provider} is unsupported or upstream is missing`);
      }

      if (!writeEnabled) {
        // Default to direct workflow for read-only runs when mode is auto. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
        await persistLogsBestEffort();
        return;
      }

      if (upstreamCanPush) {
        repoWorkflow = { mode: 'direct', provider: execution!.provider, upstream: upstream };
        await persistLogsBestEffort();
        return;
      }

      if (execution!.provider === 'github' && upstream.github) {
        const fork = await ensureGithubForkRepo({ github: execution!.github!, upstream: upstream.github, log: appendLog });
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
        const fork = await ensureGitlabForkProject({ gitlab: execution!.gitlab!, upstreamProject: upstream.gitlabProject, log: appendLog });
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

    let dependencyResult: DependencyResult | null = null;
    const robotDependencyConfig = normalizeRobotDependencyConfig((execution.robot as any).dependencyConfig);
    let hookcodeConfig: HookcodeConfig | null = null;
    try {
      // Parse repository dependency configuration to determine install steps. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
      hookcodeConfig = await hookcodeConfigService.parseConfig(repoDir);
    } catch (err: any) {
      await appendLog(`Failed to parse .hookcode.yml: ${err?.message || err}`);
      throw err;
    }

    // Apply robot overrides and run dependency installs before model execution. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (hookcodeConfig?.dependency && reuseWorkspace) {
      // Skip dependency installs when reusing the same worker's task-group workspace. docs/en/developer/plans/taskgroup-worker-env-20260203/task_plan.md taskgroup-worker-env-20260203
      await appendLog('Skipping dependency installation because this task group already has a prepared workspace on this worker.');
      dependencyResult = { status: 'skipped', steps: [], totalDuration: 0 };
      await taskService.updateDependencyResult(task.id, dependencyResult);
    } else if (hookcodeConfig?.dependency && robotDependencyConfig?.enabled === false) {
      await appendLog('Dependency installation disabled by robot configuration');
      dependencyResult = { status: 'skipped', steps: [], totalDuration: 0 };
      await taskService.updateDependencyResult(task.id, dependencyResult);
    } else if (hookcodeConfig?.dependency) {
      try {
        dependencyResult = await installDependencies({
          workspaceDir: repoDir,
          config: hookcodeConfig,
          runtimeService,
          failureMode: robotDependencyConfig?.failureMode,
          allowCustomInstall: robotDependencyConfig?.allowCustomInstall,
          appendLog,
          runCommand: async ({ command, cwd, timeoutMs }) => {
            // Execute dependency installs with explicit cwd to avoid path drift after clone. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
            const { exitCode, output } = await runCommandWithLogs(command, appendRawLog, {
              cwd,
              timeoutMs,
              redact: redactSensitiveText
            });
            return { exitCode, output };
          },
          appendThoughtChainCommand
        });
        await taskService.updateDependencyResult(task.id, dependencyResult);
      } catch (err: any) {
        if (err instanceof DependencyInstallerError) {
          dependencyResult = err.result;
          await taskService.updateDependencyResult(task.id, dependencyResult);
          if (err.code === 'RUNTIME_MISSING') {
            const message = err.message;
            const match = message.match(/Runtime \"([^\"]+)\"/);
            const language = match ? match[1] : 'unknown';
            await appendLog(buildRuntimeMissingMessage(language));
          }
        }
        throw err;
      }
    }

    if (writeEnabled) {
      // Capture a baseline git snapshot before running the model to detect later changes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      gitStatus = { enabled: true, capturedAt: new Date().toISOString(), errors: [] };
      try {
        const baselineCapture = await collectGitStatusSnapshot({ repoDir });
        gitBaseline = baselineCapture.snapshot;
        if (gitBaseline) gitStatus.baseline = gitBaseline;
        if (baselineCapture.errors.length) gitStatus.errors?.push(...baselineCapture.errors);
      } catch (captureErr: any) {
        const safeErr = redactSensitiveText(captureErr?.message || String(captureErr));
        gitStatus.errors?.push(`baseline: ${safeErr}`);
      }
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

    const outputLastMessageFileName = isClaudeCodeProvider
      ? 'claude-output.txt'
      : isGeminiCliProvider
        ? 'gemini-output.txt'
        : 'codex-output.txt';
    // Store provider outputs under a task-scoped directory outside the repo to avoid git pollution. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
    const outputSelection = buildTaskOutputFilePath({ taskId: task.id, fileName: outputLastMessageFileName, repoDir });
    const outputLastMessageFile = outputSelection.filePath;
    if (outputSelection.selection.source === 'repo-conflict') {
      await appendLog('Configured task output dir points inside the repo; falling back to safe default output root.');
    }
    await mkdir(outputSelection.dir, { recursive: true });
    await rm(outputLastMessageFile, { force: true });

    const codexCfg = isCodexProvider ? normalizeCodexRobotProviderConfig(execution.robot.modelProviderConfigRaw) : null;
    const claudeCfg = isClaudeCodeProvider ? normalizeClaudeCodeRobotProviderConfig(execution.robot.modelProviderConfigRaw) : null;
    const geminiCfg = isGeminiCliProvider ? normalizeGeminiCliRobotProviderConfig(execution.robot.modelProviderConfigRaw) : null;
    const sandboxMode = isCodexProvider
      ? codexCfg!.sandbox
      : isClaudeCodeProvider
        ? claudeCfg!.sandbox
        : geminiCfg!.sandbox;
    // Codex network access is always enabled; only non-Codex providers read robot config. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
    const networkAccess = isCodexProvider
      ? true
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

      // Load the task-group Codex schema so turns can emit structured output + suggestions. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      const outputSchema = await readCodexOutputSchema({ taskGroupDir, appendLog });

      // Execute providers from the task-group root to match the new workspace layout. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      // Change record: avoid noisy debug `console.error` logs; rely on structured logs + per-task appendLog instead.
      const res = await runCodexExecWithSdk({
        repoDir,
        workspaceDir: taskGroupDir,
        promptFile,
        model: codexCfg!.model,
        sandbox: codexCfg!.sandbox,
        // Codex execution now defaults to network access enabled regardless of robot config. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
        modelReasoningEffort: codexCfg!.model_reasoning_effort,
        resumeThreadId: resumeThreadId || undefined,
        apiKey,
        apiBaseUrl: apiBaseUrl || undefined,
        outputSchema,
        outputLastMessageFile,
        signal: abortSignal,
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

      // Execute providers from the task-group root to match the new workspace layout. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      const res = await runClaudeCodeExecWithSdk({
        repoDir,
        workspaceDir: taskGroupDir,
        promptFile,
        model: claudeCfg!.model,
        sandbox: claudeCfg!.sandbox,
        networkAccess,
        resumeSessionId: resumeThreadId || undefined,
        apiKey,
        apiBaseUrl: apiBaseUrl || undefined,
        outputLastMessageFile,
        signal: abortSignal,
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

      // Execute providers from the task-group root to match the new workspace layout. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      const res = await runGeminiCliExecWithCli({
        repoDir,
        workspaceDir: taskGroupDir,
        promptFile,
        model: geminiCfg!.model,
        sandbox: geminiCfg!.sandbox,
        networkAccess,
        resumeSessionId: resumeThreadId || undefined,
        apiKey,
        apiBaseUrl: apiBaseUrl || undefined,
        outputLastMessageFile,
        geminiHomeDir,
        signal: abortSignal,
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
    // Move provider output artifacts into the task-group root for consistent discovery. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    await moveTaskOutputToGroupRoot({
      taskGroupDir,
      fileName: outputLastMessageFileName,
      sourcePath: outputLastMessageFile,
      appendLog
    });

    // Bind the thread ID to the task group for future resumption.
    if (threadId && taskGroupId) {
      await taskService.bindTaskGroupThreadId(taskGroupId, threadId);
    }

    if (writeEnabled) {
      // Capture final git status (files/commit/push) after the model run completes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      try {
        const finalCapture = await collectGitStatusSnapshot({ repoDir, includeWorkingTree: true });
        finalizeGitStatus(finalCapture);
      } catch (captureErr: any) {
        if (!gitStatus) gitStatus = { enabled: true, capturedAt: new Date().toISOString(), errors: [] };
        const safeErr = redactSensitiveText(captureErr?.message || String(captureErr));
        if (!gitStatus.errors) gitStatus.errors = [];
        gitStatus.errors.push(`final: ${safeErr}`);
      }
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
      return { logs, logsSeq, outputText: safeOutputText ? safeOutputText : undefined, gitStatus };
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

    return { logs, logsSeq, providerCommentUrl: posted?.url, outputText: safeOutputText ? safeOutputText : undefined, gitStatus };
  } catch (err: any) {
    // Short-circuit aborts so pause/stop does not post failure comments. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    if (abortSignal?.aborted) {
      await appendLog('Execution aborted by user request.');
      const safeMessage = redactSensitiveText(err?.message || 'Task execution aborted');
      throw new AgentExecutionError(safeMessage, {
        logs,
        logsSeq,
        gitStatus,
        cause: err,
        aborted: true
      });
    }

    const payload: any = task.payload ?? {};
    const consoleUrl = getTaskConsoleUrl(task.id);
    const details = buildGitlabLogDetails(logs);
    const failureBodyParts = [
      `Task execution failed; see HookCode console: ${consoleUrl}`,
      details
    ].filter((v) => v && v.trim().length);

    if (writeEnabled && repoDir && !gitStatus?.final) {
      // Best-effort capture of git status even when execution fails. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      try {
        const finalCapture = await collectGitStatusSnapshot({ repoDir, includeWorkingTree: true });
        finalizeGitStatus(finalCapture);
      } catch (captureErr: any) {
        if (!gitStatus) gitStatus = { enabled: true, capturedAt: new Date().toISOString(), errors: [] };
        const safeErr = redactSensitiveText(captureErr?.message || String(captureErr));
        if (!gitStatus.errors) gitStatus.errors = [];
        gitStatus.errors.push(`capture: ${safeErr}`);
      }
    }

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
    // Bubble git status into failed task results for UI visibility. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    throw new AgentExecutionError(safeMessage, { logs, logsSeq, providerCommentUrl, gitStatus, cause: err });
  }
}

export { callAgent };

const runCommandWithLogs = async (
  command: string,
  log: (msg: string) => Promise<void>,
  options: StreamOptions = {}
): Promise<{ exitCode: number; output: string }> => {
  // Capture streaming command output for dependency installs while keeping log behavior consistent. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const redact = options.redact ?? redactSensitiveText;
  return await new Promise((resolve, reject) => {
    // Run commands in the resolved workspace cwd to avoid shell cd path drift. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const child = spawn('sh', ['-c', command], {
      env: { ...process.env, ...(options.env ?? {}) },
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;
    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, options.timeoutMs);
    }

    let chain = Promise.resolve();
    const outputLines: string[] = [];
    const enqueue = (line: string) => {
      const redacted = redact(line);
      outputLines.push(redacted);
      chain = chain.then(() => log(redacted)).catch((err) => {
        console.error('[runCommandWithLogs] log failed', err);
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
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', async (code) => {
      if (timer) clearTimeout(timer);
      stdoutBuffer.flush();
      stderrBuffer.flush();

      const exitCode = timedOut ? -1 : typeof code === 'number' ? code : -1;
      if (timedOut) {
        enqueue(`[timeout] ${command}`);
      } else if (exitCode !== 0) {
        enqueue(`[exit ${exitCode}] ${command}`);
      }

      await chain;
      resolve({ exitCode, output: outputLines.join('\n') });
    });
  });
};

async function streamCommand(
  command: string,
  log: (msg: string) => Promise<void>,
  options: StreamOptions = {}
): Promise<void> {
  // Stream command output into task logs while preserving failure handling. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const result = await runCommandWithLogs(command, log, options);
  if (result.exitCode !== 0) {
    throw new Error(`command failed with code ${result.exitCode}`);
  }
}

interface StreamOptions {
  env?: Record<string, string | undefined>;
  redact?: (text: string) => string;
  timeoutMs?: number;
  // Allow explicit command cwd to keep dependency installs on the intended repo root. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  cwd?: string;
}

interface CaptureOptions {
  env?: Record<string, string | undefined>;
  redact?: (text: string) => string;
  // Allow explicit cwd for command capture outside agent flow. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  cwd?: string;
}

// Export command capture for shared git operations outside the agent run. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const runCommandCapture = async (
  command: string,
  options: CaptureOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  // Capture command output for git status probing without spamming task logs. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const redact = options.redact ?? redactSensitiveText;
  return await new Promise((resolve, reject) => {
    // Honor explicit cwd to keep non-agent commands aligned with task-group workspaces. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const child = spawn('sh', ['-c', command], {
      env: { ...process.env, ...(options.env ?? {}) },
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', (code) => {
      resolve({
        stdout: redact(stdout).trimEnd(),
        stderr: redact(stderr).trimEnd(),
        exitCode: typeof code === 'number' ? code : 1
      });
    });
  });
};

// Export git status capture so push actions can refresh status. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export const collectGitStatusSnapshot = async (params: {
  repoDir: string;
  includeWorkingTree?: boolean;
}): Promise<{
  snapshot?: TaskGitStatusSnapshot;
  workingTree?: TaskGitStatusWorkingTree;
  pushTargetSha?: string;
  errors: string[];
}> => {
  // Collect git refs + working tree changes to report write-enabled task outcomes. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const errors: string[] = [];
  const gitEnv = { GIT_TERMINAL_PROMPT: '0' };
  const runGit = (cmd: string) => runCommandCapture(`cd ${shDoubleQuote(params.repoDir)} && ${cmd}`, { env: gitEnv });
  // Build git proxy flags for network commands like ls-remote. gitproxyfix20260127
  const gitProxyFlags = buildGitProxyFlags();

  const branchRes = await runGit('git rev-parse --abbrev-ref HEAD');
  const branch = branchRes.exitCode === 0 ? branchRes.stdout.trim() : '';
  if (!branchRes.exitCode && !branch) {
    errors.push('branch: empty');
  } else if (branchRes.exitCode !== 0) {
    errors.push(`branch: ${branchRes.stderr || 'command_failed'}`);
  }

  const headRes = await runGit('git rev-parse HEAD');
  const headSha = headRes.exitCode === 0 ? headRes.stdout.trim() : '';
  if (!headRes.exitCode && !headSha) {
    errors.push('head: empty');
  } else if (headRes.exitCode !== 0) {
    errors.push(`head: ${headRes.stderr || 'command_failed'}`);
  }

  const upstreamRes = await runGit('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
  const upstream = upstreamRes.exitCode === 0 ? upstreamRes.stdout.trim() : '';

  let ahead: number | undefined;
  let behind: number | undefined;
  if (upstream) {
    const aheadBehindRes = await runGit('git rev-list --left-right --count HEAD...@{u}');
    if (aheadBehindRes.exitCode === 0) {
      const parsed = parseAheadBehind(aheadBehindRes.stdout);
      if (parsed) {
        ahead = parsed.ahead;
        behind = parsed.behind;
      } else {
        errors.push('aheadBehind: parse_failed');
      }
    } else {
      errors.push(`aheadBehind: ${aheadBehindRes.stderr || 'command_failed'}`);
    }
  }

  const pushRemoteRes = await runGit('git remote get-url --push origin');
  const pushRemoteRaw = pushRemoteRes.exitCode === 0 ? pushRemoteRes.stdout.trim() : '';
  const pushRemote = pushRemoteRaw ? normalizeGitRemoteUrl(pushRemoteRaw) : '';
  const pushWebUrl = pushRemoteRaw ? toRepoWebUrl(pushRemoteRaw) : '';
  if (!pushRemote && pushRemoteRes.exitCode !== 0) {
    errors.push(`pushRemote: ${pushRemoteRes.stderr || 'command_failed'}`);
  }

  let pushTargetSha: string | undefined;
  if (pushRemoteRaw && branch && branch !== 'HEAD') {
    // Use gitProxyFlags to pass proxy config to ls-remote. gitproxyfix20260127
    const lsRemoteRes = await runGit(`git ${gitProxyFlags} ls-remote --heads ${shDoubleQuote(pushRemoteRaw)} ${shDoubleQuote(branch)}`);
    if (lsRemoteRes.exitCode === 0) {
      const line = lsRemoteRes.stdout.trim().split(/\r?\n/)[0] ?? '';
      const sha = line.split(/\s+/)[0] ?? '';
      // Treat empty ls-remote output as "not pushed yet" to avoid false failures. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      if (sha) {
        pushTargetSha = sha;
      }
    } else {
      errors.push(`pushTarget: ${lsRemoteRes.stderr || 'command_failed'}`);
    }
  }

  let workingTree: TaskGitStatusWorkingTree | undefined;
  if (params.includeWorkingTree) {
    const stagedRes = await runGit('git diff --name-only --cached');
    const unstagedRes = await runGit('git diff --name-only');
    const untrackedRes = await runGit('git ls-files --others --exclude-standard');
    workingTree = buildWorkingTree({
      stagedRaw: stagedRes.exitCode === 0 ? stagedRes.stdout : '',
      unstagedRaw: unstagedRes.exitCode === 0 ? unstagedRes.stdout : '',
      untrackedRaw: untrackedRes.exitCode === 0 ? untrackedRes.stdout : ''
    });
    if (stagedRes.exitCode !== 0) errors.push(`staged: ${stagedRes.stderr || 'command_failed'}`);
    if (unstagedRes.exitCode !== 0) errors.push(`unstaged: ${unstagedRes.stderr || 'command_failed'}`);
    if (untrackedRes.exitCode !== 0) errors.push(`untracked: ${untrackedRes.stderr || 'command_failed'}`);
  }

  const snapshot = branch && headSha
    ? {
        branch,
        headSha,
        upstream: upstream || undefined,
        ahead,
        behind,
        pushRemote: pushRemote || undefined,
        pushWebUrl: pushWebUrl || undefined
      }
    : undefined;

  return { snapshot, workingTree, pushTargetSha, errors };
};
