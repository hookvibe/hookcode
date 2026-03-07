import path from 'path';
import type { WorkerConfig } from '../config';
import type { WorkerTaskContextResponse } from '../backend/internalApiClient';

export interface HydratedTaskMetadata {
  groupId?: string;
  threadId?: string | null;
  hasPriorTaskGroupTask?: boolean;
  hasTaskGroupLogs?: boolean;
  skillSelection?: string[] | null;
  promptPrefix?: string;
}

export interface ResolvedTaskCommand {
  command: string;
  source: string;
}

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const sanitizeEnvKey = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const safeWorkspaceSegment = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'task';
};

const collectScalarEnv = (
  prefix: string,
  value: unknown,
  target: Record<string, string>,
  depth = 0
): void => {
  if (depth > 4 || value == null) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    target[prefix] = String(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectScalarEnv(`${prefix}_${index}`, entry, target, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      collectScalarEnv(`${prefix}_${sanitizeEnvKey(key)}`, entry, target, depth + 1);
    });
  }
};

const lookupString = (root: unknown, pathSegments: string[]): string => {
  let current: unknown = root;
  for (const segment of pathSegments) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[segment];
  }
  return trimString(current);
};

const COMMAND_PATHS: Array<{ path: string[]; source: string }> = [
  { path: ['executionCommand'], source: 'task.executionCommand' },
  { path: ['command'], source: 'task.command' },
  { path: ['executor', 'command'], source: 'task.executor.command' },
  { path: ['payload', 'command'], source: 'task.payload.command' },
  { path: ['payload', 'executor', 'command'], source: 'task.payload.executor.command' },
  { path: ['payload', 'hookcode', 'command'], source: 'task.payload.hookcode.command' }
];

const renderTemplate = (template: string, variables: Record<string, string>): string =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => variables[key] ?? '');

export const resolveTaskCommand = (
  task: Record<string, unknown> | null | undefined,
  config: WorkerConfig,
  metadata?: HydratedTaskMetadata
): ResolvedTaskCommand | null => {
  const variables = {
    taskId: trimString(task?.id),
    repoId: trimString(task?.repoId),
    taskGroupId: trimString(task?.taskGroupId) || trimString(metadata?.groupId),
    robotId: trimString(task?.robotId),
    backendUrl: config.backendUrl
  };

  if (config.execCommandTemplate) {
    return {
      command: renderTemplate(config.execCommandTemplate, variables),
      source: 'env.HOOKCODE_WORKER_EXEC_COMMAND'
    };
  }

  for (const candidate of COMMAND_PATHS) {
    const command = lookupString(task, candidate.path);
    if (command) {
      return { command, source: candidate.source };
    }
  }

  return null;
};

export const resolveTaskWorkspaceDir = (
  workspaceRootDir: string,
  task: Record<string, unknown> | null | undefined,
  metadata?: HydratedTaskMetadata
): string => {
  const groupId = trimString(task?.taskGroupId) || trimString(metadata?.groupId);
  const taskId = trimString(task?.id);
  const folderName = safeWorkspaceSegment(groupId || taskId || 'task');
  // Keep one sticky workspace per task group to preserve runner-like state even before backend ships repo bootstrap envelopes. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  return path.join(workspaceRootDir, folderName);
};

export const buildTaskEnvironment = (params: {
  config: WorkerConfig;
  context: WorkerTaskContextResponse;
  metadata?: HydratedTaskMetadata;
  workspaceDir: string;
}): Record<string, string> => {
  const task = params.context.task ?? {};
  const env: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    ),
    HOOKCODE_BACKEND_URL: params.config.backendUrl,
    HOOKCODE_WORKER_ID: params.config.workerId,
    HOOKCODE_WORKER_NAME: params.config.workerName,
    HOOKCODE_WORKER_KIND: params.config.workerKind,
    HOOKCODE_TASK_ID: trimString(task.id),
    HOOKCODE_TASK_GROUP_ID: trimString(task.taskGroupId) || trimString(params.metadata?.groupId),
    HOOKCODE_REPO_ID: trimString(task.repoId),
    HOOKCODE_ROBOT_ID: trimString(task.robotId),
    HOOKCODE_WORKSPACE_DIR: params.workspaceDir,
    HOOKCODE_SKILL_PROMPT_PREFIX: trimString(params.metadata?.promptPrefix),
    HOOKCODE_TASK_GROUP_THREAD_ID: trimString(params.metadata?.threadId),
    HOOKCODE_TASK_GROUP_HAS_PRIOR_TASK: String(Boolean(params.metadata?.hasPriorTaskGroupTask)),
    HOOKCODE_TASK_GROUP_HAS_LOGS: String(Boolean(params.metadata?.hasTaskGroupLogs))
  };

  collectScalarEnv('HOOKCODE_TASK', task, env);
  collectScalarEnv('HOOKCODE_REPO', params.context.repo, env);
  collectScalarEnv('HOOKCODE_REPO_CREDENTIALS', params.context.repoScopedCredentials, env);
  collectScalarEnv('HOOKCODE_DEFAULT_USER', params.context.defaultUserCredentials, env);
  collectScalarEnv('HOOKCODE_TASK_PAYLOAD_ENV', (task as Record<string, unknown>).payload, env);
  collectScalarEnv('HOOKCODE_TASK_METADATA', params.metadata, env);

  const taskEnv = (task as Record<string, unknown>).env;
  if (taskEnv && typeof taskEnv === 'object' && !Array.isArray(taskEnv)) {
    Object.entries(taskEnv as Record<string, unknown>).forEach(([key, value]) => {
      if (value == null) return;
      env[sanitizeEnvKey(key)] = String(value);
    });
  }

  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
};

export const summarizeInjectedEnvironment = (env: Record<string, string>): { count: number; redactedKeys: string[] } => {
  const redactedKeys = Object.keys(env).filter((key) => /(TOKEN|PASSWORD|SECRET|PRIVATE_KEY|ACCESS_KEY)/.test(key));
  return { count: Object.keys(env).length, redactedKeys };
};
