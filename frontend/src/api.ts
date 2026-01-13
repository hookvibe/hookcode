import axios from 'axios';
import type { AuthUser } from './auth';
import { clearAuth, getToken, saveLoginNext } from './auth';

/**
 * Frontend Chat API client (axios):
 * - Business context: connect the new `frontend-chat` UI to the existing HookCode backend APIs.
 * - Compatibility: keep env var (`VITE_API_BASE_URL`) and auth redirect behavior aligned with the legacy frontend.
 *
 * Usage:
 * - Import request helpers (e.g. `fetchTasks`, `fetchTaskGroups`) from this module.
 * - Auth: token is injected via `Authorization: Bearer ...` automatically (see request interceptor).
 *
 * Change record:
 * - 2026-01-11: Migrated API layer from the legacy frontend to unblock page migration to `frontend-chat`.
 */
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: apiBaseUrl
});

export type TaskStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'commented';

export type TaskEventType =
  | 'issue'
  | 'commit'
  | 'merge_request'
  | 'issue_created'
  | 'issue_comment'
  | 'commit_review'
  | 'push'
  | 'note'
  | 'unknown'
  | (string & {});

export interface TaskRepoSummary {
  id: string;
  provider: RepoProvider;
  name: string;
  enabled: boolean;
}

export interface TaskRobotSummary {
  id: string;
  repoId: string;
  name: string;
  permission: RobotPermission;
  enabled: boolean;
}

export interface Task {
  id: string;
  groupId?: string;
  eventType: TaskEventType;
  status: TaskStatus;
  payload?: unknown;
  promptCustom?: string;
  title?: string;
  projectId?: number;
  repoProvider?: RepoProvider;
  repoId?: string;
  robotId?: string;
  ref?: string;
  mrId?: number;
  issueId?: number;
  retries: number;
  result?: TaskResult;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
  permissions?: { canManage: boolean };
}

export interface TaskResult {
  summary?: string;
  message?: string;
  logs?: string[];
  outputText?: string;
  providerCommentUrl?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  [key: string]: unknown;
}

// Change record: add `chat` to support console manual-trigger task groups.
export type TaskGroupKind = 'issue' | 'merge_request' | 'commit' | 'task' | 'chat';

export interface TaskGroup {
  id: string;
  kind: TaskGroupKind;
  bindingKey: string;
  threadId?: string | null;
  title?: string;
  repoProvider?: RepoProvider;
  repoId?: string;
  robotId?: string;
  issueId?: number;
  mrId?: number;
  commitSha?: string;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
}

export const fetchTaskGroups = async (options?: {
  limit?: number;
  repoId?: string;
  robotId?: string;
  kind?: TaskGroupKind;
}): Promise<TaskGroup[]> => {
  const { data } = await api.get<{ taskGroups: TaskGroup[] }>('/task-groups', { params: options });
  return data.taskGroups;
};

export const fetchTaskGroup = async (id: string): Promise<TaskGroup> => {
  const { data } = await api.get<{ taskGroup: TaskGroup }>(`/task-groups/${id}`);
  return data.taskGroup;
};

export const fetchTaskGroupTasks = async (id: string, options?: { limit?: number }): Promise<Task[]> => {
  const { data } = await api.get<{ tasks: Task[] }>(`/task-groups/${id}/tasks`, { params: options });
  return data.tasks;
};

export const executeChat = async (params: {
  repoId: string;
  robotId: string;
  text: string;
  taskGroupId?: string;
}): Promise<{ taskGroup: TaskGroup; task: Task }> => {
  // Business context:
  // - Manual trigger without Webhooks (frontend Chat page + chat embeds under task/taskGroup pages).
  // - Change record: added to call backend `/chat` endpoint.
  const { data } = await api.post<{ taskGroup: TaskGroup; task: Task }>('/chat', params);
  return data;
};

export const fetchTasks = async (options?: {
  limit?: number;
  repoId?: string;
  robotId?: string;
  status?: TaskStatus | 'success';
  eventType?: string;
}): Promise<Task[]> => {
  const { data } = await api.get<{ tasks: Task[] }>('/tasks', { params: options });
  return data.tasks;
};

export interface TaskStatusStats {
  total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
}

export const fetchTaskStats = async (options?: {
  repoId?: string;
  robotId?: string;
  eventType?: string;
}): Promise<TaskStatusStats> => {
  const { data } = await api.get<{ stats: TaskStatusStats }>('/tasks/stats', { params: options });
  return data.stats;
};

export const fetchTask = async (taskId: string): Promise<Task> => {
  const { data } = await api.get<{ task: Task }>(`/tasks/${taskId}`);
  return data.task;
};

export const retryTask = async (taskId: string, options?: { force?: boolean }): Promise<Task> => {
  const params = options?.force ? { force: 'true' } : undefined;
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/retry`, null, { params });
  return data.task;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};

export const clearTaskLogs = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}/logs`);
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && typeof window !== 'undefined') {
      const requestUrl = String(error?.config?.url || '').split('?')[0];
      const skipRedirect = requestUrl.endsWith('/auth/login');
      if (!skipRedirect) {
        saveLoginNext(window.location.hash);
        clearAuth();
        if (!window.location.hash.startsWith('#/login')) {
          window.location.hash = '#/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const login = async (params: { username: string; password: string }): Promise<{
  token: string;
  expiresAt: string;
  user: AuthUser;
}> => {
  const { data } = await api.post<{ token: string; expiresAt: string; user: AuthUser }>('/auth/login', params);
  return data;
};

export interface AuthMeResponse {
  authEnabled: boolean;
  user: AuthUser | null;
  features?: { taskLogsEnabled?: boolean };
  token?: { iat: number; exp: number };
}

export const fetchAuthMe = async (): Promise<AuthMeResponse> => {
  const { data } = await api.get<AuthMeResponse>('/auth/me');
  return data;
};

export interface User {
  id: string;
  username: string;
  displayName?: string;
  roles?: string[];
  createdAt: string;
  updatedAt: string;
}

export const fetchMe = async (): Promise<User> => {
  const { data } = await api.get<{ user: User }>('/users/me');
  return data.user;
};

export const updateMe = async (params: { displayName?: string | null }): Promise<User> => {
  const { data } = await api.patch<{ user: User }>('/users/me', params);
  return data.user;
};

export const changeMyPassword = async (params: { currentPassword: string; newPassword: string }): Promise<void> => {
  await api.patch('/users/me/password', params);
};

export interface UserModelCredentialsPublic {
  codex?: { apiBaseUrl?: string; hasApiKey: boolean };
  claude_code?: { hasApiKey: boolean };
  gemini_cli?: { hasApiKey: boolean };
  gitlab?: UserRepoProviderCredentialsPublic;
  github?: UserRepoProviderCredentialsPublic;
  [key: string]: any;
}

export interface UserRepoProviderCredentialProfilePublic {
  id: string;
  name: string;
  hasToken: boolean;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentialsPublic {
  profiles: UserRepoProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export const fetchMyModelCredentials = async (): Promise<UserModelCredentialsPublic> => {
  const { data } = await api.get<{ credentials: UserModelCredentialsPublic }>('/users/me/model-credentials');
  return data.credentials;
};

export const updateMyModelCredentials = async (params: {
  codex?: { apiBaseUrl?: string | null; apiKey?: string | null };
  claude_code?: { apiKey?: string | null };
  gemini_cli?: { apiKey?: string | null };
  gitlab?: {
    profiles?: Array<{
      id?: string;
      name?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  };
  github?: {
    profiles?: Array<{
      id?: string;
      name?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  };
}): Promise<UserModelCredentialsPublic> => {
  const { data } = await api.patch<{ credentials: UserModelCredentialsPublic }>('/users/me/model-credentials', params);
  return data.credentials;
};

export interface AdminToolsMeta {
  enabled: boolean;
  ports: {
    prisma: number;
    swagger: number;
  };
}

export const fetchAdminToolsMeta = async (): Promise<AdminToolsMeta> => {
  const { data } = await api.get<AdminToolsMeta>('/tools/meta');
  return data;
};

export type RepoProvider = 'gitlab' | 'github';

export interface RepositoryBranch {
  name: string;
  note?: string;
  isDefault?: boolean;
}

export interface Repository {
  id: string;
  provider: RepoProvider;
  name: string;
  externalId?: string;
  apiBaseUrl?: string;
  webhookVerifiedAt?: string;
  branches?: RepositoryBranch[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RobotPermission = 'read' | 'write';

export type ModelProvider = 'codex' | 'claude_code' | 'gemini_cli' | (string & {});

export type CodexModel = 'gpt-5.2' | 'gpt-5.1-codex-max' | 'gpt-5.1-codex-mini';
export type CodexSandbox = 'workspace-write' | 'read-only';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface CodexRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credential?: { apiBaseUrl?: string; hasApiKey: boolean };
  model: CodexModel;
  sandbox: CodexSandbox;
  model_reasoning_effort: CodexReasoningEffort;
  sandbox_workspace_write: { network_access: boolean };
}

export type ClaudeCodeSandbox = 'workspace-write' | 'read-only';

export interface ClaudeCodeRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credential?: { hasApiKey: boolean };
  model: string;
  sandbox: ClaudeCodeSandbox;
  sandbox_workspace_write: { network_access: boolean };
}

export type GeminiCliSandbox = 'workspace-write' | 'read-only';

export interface GeminiCliRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credential?: { hasApiKey: boolean };
  model: string;
  sandbox: GeminiCliSandbox;
  sandbox_workspace_write: { network_access: boolean };
}

export interface RepoScopedCredentialsPublic {
  repoProvider: { hasToken: boolean; cloneUsername?: string };
  modelProvider: {
    codex: { apiBaseUrl?: string; hasApiKey: boolean };
    claude_code: { hasApiKey: boolean };
    gemini_cli: { hasApiKey: boolean };
  };
}

export interface RepoRobot {
  id: string;
  repoId: string;
  name: string;
  permission: RobotPermission;
  hasToken: boolean;
  repoCredentialProfileId?: string;
  cloneUsername?: string;
  repoTokenUserId?: string;
  repoTokenUsername?: string;
  repoTokenUserName?: string;
  repoTokenUserEmail?: string;
  repoTokenRepoRole?: string;
  repoTokenRepoRoleDetails?: unknown;
  promptDefault?: string;
  language?: string;
  modelProvider?: ModelProvider;
  modelProviderConfig?: CodexRobotProviderConfigPublic | ClaudeCodeRobotProviderConfigPublic | GeminiCliRobotProviderConfigPublic;
  defaultBranch?: string;
  // Compatibility: legacy field.
  defaultBranchRole?: 'main' | 'dev' | 'test';
  activatedAt?: string;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AutomationEventKey = 'issue' | 'commit' | 'merge_request' | (string & {});

export type AutomationClauseOp = 'equals' | 'in' | 'containsAny' | 'matchesAny' | 'exists' | 'textContainsAny';

export interface AutomationClause {
  field: string;
  op: AutomationClauseOp;
  value?: string;
  values?: string[];
  negate?: boolean;
}

export interface AutomationMatch {
  all?: AutomationClause[];
  any?: AutomationClause[];
}

export interface AutomationAction {
  id: string;
  robotId: string;
  enabled: boolean;
  promptOverride?: string;
  promptPatch?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  match?: AutomationMatch;
  actions: AutomationAction[];
}

export interface AutomationEventConfig {
  enabled: boolean;
  rules: AutomationRule[];
}

export interface RepoAutomationConfigV1 {
  version: 1;
  events: Record<string, AutomationEventConfig | undefined>;
}

export interface RepoAutomationConfigV2 {
  version: 2;
  events: Record<string, AutomationEventConfig | undefined>;
}

export type RepoAutomationConfig = RepoAutomationConfigV1 | RepoAutomationConfigV2;

export type RepoWebhookDeliveryResult = 'accepted' | 'skipped' | 'rejected' | 'error';

export interface RepoWebhookDeliverySummary {
  id: string;
  repoId: string;
  provider: RepoProvider;
  eventName?: string;
  deliveryId?: string;
  result: RepoWebhookDeliveryResult;
  httpStatus: number;
  code?: string;
  message?: string;
  taskIds: string[];
  createdAt: string;
}

export interface RepoWebhookDeliveryDetail extends RepoWebhookDeliverySummary {
  payload?: unknown;
  response?: unknown;
}

export const listRepos = async (): Promise<Repository[]> => {
  const { data } = await api.get<{ repos: Repository[] }>('/repos');
  return data.repos;
};

export const listRepoRobots = async (repoId: string): Promise<RepoRobot[]> => {
  const { data } = await api.get<{ robots: RepoRobot[] }>(`/repos/${repoId}/robots`);
  return data.robots;
};

export const createRepo = async (params: {
  provider: RepoProvider;
  name: string;
  externalId?: string | null;
  apiBaseUrl?: string | null;
  webhookSecret?: string | null;
}): Promise<{ repo: Repository; webhookSecret: string; webhookPath: string }> => {
  const { data } = await api.post<{ repo: Repository; webhookSecret: string; webhookPath: string }>('/repos', params);
  return data;
};

export const fetchRepo = async (
  id: string
): Promise<{
  repo: Repository;
  robots: RepoRobot[];
  automationConfig: RepoAutomationConfig | null;
  webhookSecret?: string | null;
  webhookPath?: string;
  repoScopedCredentials?: RepoScopedCredentialsPublic;
}> => {
  const { data } = await api.get<{
    repo: Repository;
    robots: RepoRobot[];
    automationConfig: RepoAutomationConfig | null;
    webhookSecret?: string | null;
    webhookPath?: string;
    repoScopedCredentials?: RepoScopedCredentialsPublic;
  }>(`/repos/${id}`);
  return data;
};

export const listRepoWebhookDeliveries = async (
  repoId: string,
  params?: { limit?: number; cursor?: string }
): Promise<{ deliveries: RepoWebhookDeliverySummary[]; nextCursor?: string }> => {
  const { data } = await api.get<{ deliveries: RepoWebhookDeliverySummary[]; nextCursor?: string }>(
    `/repos/${repoId}/webhook-deliveries`,
    { params }
  );
  return data;
};

export const fetchRepoWebhookDelivery = async (repoId: string, deliveryId: string): Promise<RepoWebhookDeliveryDetail> => {
  const { data } = await api.get<{ delivery: RepoWebhookDeliveryDetail }>(
    `/repos/${repoId}/webhook-deliveries/${deliveryId}`
  );
  return data.delivery;
};

export const updateRepo = async (
  id: string,
  params: Partial<{
    name: string;
    externalId: string | null;
    apiBaseUrl: string | null;
    branches: RepositoryBranch[] | null;
    enabled: boolean;
    repoProviderCredential:
      | {
          token?: string | null;
          cloneUsername?: string | null;
        }
      | null;
    modelProviderCredential:
      | {
          codex?:
            | {
                apiBaseUrl?: string | null;
                apiKey?: string | null;
              }
            | null;
          claude_code?:
            | {
                apiKey?: string | null;
              }
            | null;
          gemini_cli?:
            | {
                apiKey?: string | null;
              }
            | null;
        }
      | null;
  }>
): Promise<{ repo: Repository; repoScopedCredentials?: RepoScopedCredentialsPublic }> => {
  const { data } = await api.patch<{ repo: Repository; repoScopedCredentials?: RepoScopedCredentialsPublic }>(
    `/repos/${id}`,
    params
  );
  return data;
};

export const createRepoRobot = async (
  repoId: string,
  params: {
    name: string;
    token?: string | null;
    cloneUsername?: string | null;
    repoCredentialProfileId?: string | null;
    promptDefault?: string | null;
    language?: string | null;
    modelProvider?: ModelProvider | null;
    modelProviderConfig?: unknown;
    defaultBranch?: string | null;
    // Compatibility: legacy field accepted by backend (main/dev/test).
    defaultBranchRole?: 'main' | 'dev' | 'test' | null;
    enabled?: boolean;
    isDefault?: boolean;
  }
): Promise<RepoRobot> => {
  const { data } = await api.post<{ robot: RepoRobot }>(`/repos/${repoId}/robots`, params);
  return data.robot;
};

export const updateRepoRobot = async (
  repoId: string,
  robotId: string,
  params: Partial<{
    name: string;
    token: string | null;
    cloneUsername: string | null;
    repoCredentialProfileId: string | null;
    promptDefault: string | null;
    language: string | null;
    modelProvider: ModelProvider | null;
    modelProviderConfig: unknown;
    defaultBranch: string | null;
    // Compatibility: legacy field accepted by backend (main/dev/test).
    defaultBranchRole: 'main' | 'dev' | 'test' | null;
    enabled: boolean;
    isDefault: boolean;
  }>
): Promise<RepoRobot> => {
  const { data } = await api.patch<{ robot: RepoRobot }>(`/repos/${repoId}/robots/${robotId}`, params);
  return data.robot;
};

export const testRepoRobot = async (
  repoId: string,
  robotId: string,
  params?: { branch?: string; reason?: string }
): Promise<{ ok: boolean; robot: RepoRobot; message?: string }> => {
  const { data } = await api.post<{ ok: boolean; robot: RepoRobot; message?: string }>(`/repos/${repoId}/robots/${robotId}/test`, params);
  return data;
};

export const deleteRepoRobot = async (repoId: string, robotId: string): Promise<void> => {
  await api.delete(`/repos/${repoId}/robots/${robotId}`);
};

export const updateRepoAutomation = async (repoId: string, config: RepoAutomationConfig): Promise<RepoAutomationConfig> => {
  const { data } = await api.put<{ config: RepoAutomationConfig }>(`/repos/${repoId}/automation`, { config });
  return data.config;
};

export type RepoCredentialProfileStatus = 'ready' | 'missing_repo_token' | 'missing_clone_username';

export interface RepoCredentialProfile {
  id: string;
  repoId: string;
  name: string;
  status: RepoCredentialProfileStatus;
  cloneUsername?: string;
  hasToken: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listRepoCredentialProfiles = async (repoId: string): Promise<RepoCredentialProfile[]> => {
  const { data } = await api.get<{ profiles: RepoCredentialProfile[] }>(`/repos/${repoId}/credential-profiles`);
  return data.profiles;
};

export const createRepoCredentialProfile = async (
  repoId: string,
  params: { name: string; token?: string | null; cloneUsername?: string | null }
): Promise<{ profile: RepoCredentialProfile }> => {
  const { data } = await api.post<{ profile: RepoCredentialProfile }>(`/repos/${repoId}/credential-profiles`, params);
  return data;
};

export const updateRepoCredentialProfile = async (
  repoId: string,
  profileId: string,
  params: Partial<{ name: string; token: string | null; cloneUsername: string | null }>
): Promise<{ profile: RepoCredentialProfile }> => {
  const { data } = await api.patch<{ profile: RepoCredentialProfile }>(
    `/repos/${repoId}/credential-profiles/${profileId}`,
    params
  );
  return data;
};

export const deleteRepoCredentialProfile = async (repoId: string, profileId: string): Promise<void> => {
  await api.delete(`/repos/${repoId}/credential-profiles/${profileId}`);
};
