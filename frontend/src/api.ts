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

// Export the API base URL so iframe previews can reuse the same origin. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const API_BASE_URL = apiBaseUrl;

export const api = axios.create({
  baseURL: apiBaseUrl
});

type GetCacheEntry<T> = { value: T; expiresAt: number };

const GET_CACHE_MAX_ENTRIES = 400;
const getCache = new Map<string, GetCacheEntry<any>>();
const getInflight = new Map<string, Promise<any>>();

const stableStringify = (value: any): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const buildGetCacheKey = (url: string, params?: Record<string, any>): string => {
  // Build stable GET cache keys for in-flight de-dup and short TTL caching across pages. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  if (!params || Object.keys(params).length === 0) return url;
  return `${url}?${stableStringify(params)}`;
};

const pruneGetCache = (now: number) => {
  for (const [key, entry] of getCache.entries()) {
    if (entry.expiresAt <= now) getCache.delete(key);
  }
  while (getCache.size > GET_CACHE_MAX_ENTRIES) {
    const oldestKey = getCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    getCache.delete(oldestKey);
  }
};

const invalidateGetCache = (prefix: string) => {
  // Clear cached GET responses after mutations to avoid stale lists. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  for (const key of Array.from(getCache.keys())) {
    if (key.startsWith(prefix)) getCache.delete(key);
  }
  for (const key of Array.from(getInflight.keys())) {
    if (key.startsWith(prefix)) getInflight.delete(key);
  }
};

const getCached = async <T>(
  url: string,
  options?: { params?: Record<string, any>; cacheTtlMs?: number; dedupe?: boolean }
): Promise<T> => {
  const params = options?.params;
  const cacheKey = buildGetCacheKey(url, params);
  const now = Date.now();
  const ttl = options?.cacheTtlMs ?? 0;

  if (ttl > 0) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value as T;
  }

  const allowDedupe = options?.dedupe !== false;
  if (allowDedupe) {
    const inflight = getInflight.get(cacheKey);
    if (inflight) return inflight as Promise<T>;
  }

  const request = api
    .get<T>(url, { params })
    .then((res) => {
      if (ttl > 0) {
        getCache.set(cacheKey, { value: res.data, expiresAt: now + ttl });
        pruneGetCache(now);
      }
      return res.data;
    })
    .finally(() => {
      getInflight.delete(cacheKey);
    });

  if (allowDedupe) getInflight.set(cacheKey, request);
  return request;
};

const invalidateRepoCaches = () => {
  // Keep repo lists and summaries fresh after repo/robot/automation mutations. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateGetCache('/repos');
};

const invalidateTaskCaches = () => {
  // Clear task-related list caches after task mutations or chat execution. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateGetCache('/tasks');
  invalidateGetCache('/tasks/stats');
  invalidateGetCache('/tasks/volume');
  invalidateGetCache('/dashboard/sidebar');
  invalidateGetCache('/task-groups');
};

export type ArchiveScope = 'active' | 'archived' | 'all'; // Keep archive filtering consistent with backend query params. qnp1mtxhzikhbi0xspbc

export type TaskStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'commented';
export type TaskQueueReasonCode =
  | 'queue_backlog'
  | 'no_active_worker'
  | 'inline_worker_disabled'
  | 'outside_time_window'
  | 'unknown';

// Shared hour-level time window shape for scheduling inputs. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
export interface TimeWindow {
  startHour: number;
  endHour: number;
}

export interface TaskQueueTimeWindow {
  // Provide time window metadata for queued task explanations. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  startHour: number;
  endHour: number;
  source: 'robot' | 'trigger' | 'chat';
  timezone: 'server';
}

export interface TaskQueueDiagnosis {
  // Surface queued-task diagnosis so the UI can explain long-waiting tasks. f3a9c2d8e1b7f4a0c6d1
  reasonCode: TaskQueueReasonCode;
  ahead: number;
  queuedTotal: number;
  processing: number;
  staleProcessing: number;
  inlineWorkerEnabled: boolean;
  timeWindow?: TaskQueueTimeWindow;
}

export interface DependencyInstallStep {
  // Dependency install steps returned by task APIs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  command?: string;
  workdir?: string;
  status: 'success' | 'skipped' | 'failed';
  duration?: number;
  error?: string;
  reason?: string;
}

export interface DependencyResult {
  status: 'success' | 'partial' | 'skipped' | 'failed';
  steps: DependencyInstallStep[];
  totalDuration: number;
}

export interface RuntimeInfo {
  // Runtime metadata returned by `/api/system/runtimes`. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  version: string;
  path: string;
  packageManager?: string;
}

export interface SystemRuntimesResponse {
  runtimes: RuntimeInfo[];
  detectedAt?: string;
}

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
  // Expose robot model provider on task summaries for UI display. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
  modelProvider?: ModelProvider;
  enabled: boolean;
}

export interface Task {
  id: string;
  groupId?: string;
  eventType: TaskEventType;
  status: TaskStatus;
  // Archived tasks are excluded from default lists and the worker queue. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
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
  queue?: TaskQueueDiagnosis;
  result?: TaskResult;
  // Capture dependency install results for display/diagnostics. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyResult?: DependencyResult;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
  permissions?: { canManage: boolean };
}

export interface TaskGitStatusSnapshot {
  // Mirror backend git snapshot payload for UI rendering. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  branch: string;
  headSha: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  pushRemote?: string;
  pushWebUrl?: string;
}

export interface TaskGitStatusWorkingTree {
  // Track local file change lists for the task detail and group views. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface TaskGitStatusDelta {
  // Flag branch/head changes between baseline and final snapshots. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  branchChanged: boolean;
  headChanged: boolean;
}

export interface TaskGitStatusPushState {
  // Track push results for write-enabled robots (fork or upstream). docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  status: 'pushed' | 'unpushed' | 'unknown' | 'error' | 'not_applicable';
  reason?: string;
  targetBranch?: string;
  targetWebUrl?: string;
  targetHeadSha?: string;
}

export interface TaskGitStatus {
  // Provide git change tracking metadata for frontend rendering. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  enabled: boolean;
  capturedAt?: string;
  baseline?: TaskGitStatusSnapshot;
  final?: TaskGitStatusSnapshot;
  delta?: TaskGitStatusDelta;
  workingTree?: TaskGitStatusWorkingTree;
  push?: TaskGitStatusPushState;
  errors?: string[];
}

export interface TaskResult {
  summary?: string;
  message?: string;
  logs?: string[];
  outputText?: string;
  providerCommentUrl?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  // Surface backend git status in task result payloads for UI reuse. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  gitStatus?: TaskGitStatus;
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
  // Archived groups are excluded from default sidebar/chat lists. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  repo?: TaskRepoSummary;
  robot?: TaskRobotSummary;
}

// Define preview API response types for TaskGroup dev server status. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export type PreviewInstanceStatus = 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

// Surface preview diagnostics and log payloads for Phase 3 UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewLogEntry {
  timestamp: string;
  level: 'stdout' | 'stderr' | 'system';
  message: string;
}

// Attach diagnostics to preview status payloads for failed/timeout sessions. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewDiagnostics {
  exitCode?: number | null;
  signal?: string | null;
  logs?: PreviewLogEntry[];
}

export interface PreviewInstanceSummary {
  name: string;
  status: PreviewInstanceStatus;
  port?: number;
  path?: string;
  message?: string;
  diagnostics?: PreviewDiagnostics;
}

export interface PreviewStatusResponse {
  available: boolean;
  instances: PreviewInstanceSummary[];
  reason?: 'config_missing' | 'config_invalid' | 'workspace_missing' | 'invalid_group' | 'missing_task';
}

// Shape repo preview config responses for the repo detail dashboard. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface RepoPreviewInstanceSummary {
  name: string;
  workdir: string;
}

export interface RepoPreviewConfigResponse {
  available: boolean;
  instances: RepoPreviewInstanceSummary[];
  reason?: 'no_workspace' | 'config_missing' | 'config_invalid' | 'workspace_missing';
}

export const fetchTaskGroups = async (options?: {
  limit?: number;
  repoId?: string;
  robotId?: string;
  kind?: TaskGroupKind;
  archived?: ArchiveScope;
}): Promise<TaskGroup[]> => {
  const data = await getCached<{ taskGroups: TaskGroup[] }>('/task-groups', {
    params: options,
    cacheTtlMs: 5000
  });
  return data.taskGroups;
};

export const fetchTaskGroup = async (id: string): Promise<TaskGroup> => {
  const data = await getCached<{ taskGroup: TaskGroup }>(`/task-groups/${id}`);
  return data.taskGroup;
};

export const fetchTaskGroupTasks = async (id: string, options?: { limit?: number }): Promise<Task[]> => {
  const data = await getCached<{ tasks: Task[] }>(`/task-groups/${id}/tasks`, { params: options });
  return data.tasks;
};

// Preview API helpers for TaskGroup dev server lifecycle. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const fetchTaskGroupPreviewStatus = async (id: string): Promise<PreviewStatusResponse> => {
  const { data } = await api.get<PreviewStatusResponse>(`/task-groups/${id}/preview/status`);
  return data;
};

export const startTaskGroupPreview = async (id: string): Promise<{ success: boolean; instances: PreviewInstanceSummary[] }> => {
  const { data } = await api.post<{ success: boolean; instances: PreviewInstanceSummary[] }>(`/task-groups/${id}/preview/start`);
  return data;
};

export const stopTaskGroupPreview = async (id: string): Promise<{ success: boolean }> => {
  const { data } = await api.post<{ success: boolean }>(`/task-groups/${id}/preview/stop`);
  return data;
};

// Fetch repository preview config availability for repo detail UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const fetchRepoPreviewConfig = async (id: string): Promise<RepoPreviewConfigResponse> => {
  const { data } = await api.get<RepoPreviewConfigResponse>(`/repos/${id}/preview/config`);
  return data;
};

export const executeChat = async (params: {
  repoId: string;
  robotId: string;
  text: string;
  taskGroupId?: string;
  timeWindow?: TimeWindow | null;
}): Promise<{ taskGroup: TaskGroup; task: Task }> => {
  // Business context:
  // - Manual trigger without Webhooks (frontend Chat page + chat embeds under task/taskGroup pages).
  // - Change record: added to call backend `/chat` endpoint.
  const { data } = await api.post<{ taskGroup: TaskGroup; task: Task }>('/chat', params);
  invalidateTaskCaches();
  return data;
};

export const fetchTasks = async (options?: {
  limit?: number;
  repoId?: string;
  robotId?: string;
  status?: TaskStatus | 'success';
  eventType?: string;
  archived?: ArchiveScope;
  // Allow dashboards to skip queue diagnosis to reduce payload cost. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  includeQueue?: boolean;
}): Promise<Task[]> => {
  const data = await getCached<{ tasks: Task[] }>('/tasks', { params: options });
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
  archived?: ArchiveScope;
}): Promise<TaskStatusStats> => {
  const data = await getCached<{ stats: TaskStatusStats }>('/tasks/stats', {
    params: options,
    cacheTtlMs: 5000
  });
  return data.stats;
};

export interface TaskVolumePoint {
  day: string;
  count: number;
}

export const fetchTaskVolumeByDay = async (options: {
  repoId: string;
  startDay: string;
  endDay: string;
  robotId?: string;
  eventType?: string;
  archived?: ArchiveScope;
}): Promise<TaskVolumePoint[]> => {
  // Fetch per-day task volume for the repo dashboard trend chart (UTC buckets). dashtrendline20260119m9v2
  const data = await getCached<{ points: TaskVolumePoint[] }>('/tasks/volume', {
    params: options,
    cacheTtlMs: 30000
  });
  return data.points;
};

export interface DashboardSidebarSnapshot {
  stats: TaskStatusStats;
  tasksByStatus: {
    queued: Task[];
    processing: Task[];
    success: Task[];
    failed: Task[];
  };
  taskGroups: TaskGroup[];
}

export const fetchDashboardSidebar = async (options?: {
  tasksLimit?: number;
  taskGroupsLimit?: number;
  repoId?: string;
  robotId?: string;
  eventType?: string;
}): Promise<DashboardSidebarSnapshot> => {
  // Reduce redundant sidebar polling calls by fetching a consistent snapshot in one request. 7bqwou6abx4ste96ikhv
  return getCached<DashboardSidebarSnapshot>('/dashboard/sidebar', { params: options, cacheTtlMs: 3000 });
};

export const fetchTask = async (taskId: string): Promise<Task> => {
  const data = await getCached<{ task: Task }>(`/tasks/${taskId}`);
  return data.task;
};

export const retryTask = async (taskId: string, options?: { force?: boolean }): Promise<Task> => {
  const params = options?.force ? { force: 'true' } : undefined;
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/retry`, null, { params });
  invalidateTaskCaches();
  return data.task;
};

export const executeTaskNow = async (taskId: string): Promise<Task> => {
  // Override time-window gating for queued tasks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/execute-now`);
  invalidateTaskCaches();
  return data.task;
};

export const pushTaskGitChanges = async (taskId: string): Promise<Task> => {
  // Trigger a git push for forked task changes and return the updated task. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/git/push`);
  invalidateTaskCaches();
  return data.task;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
  invalidateTaskCaches();
};

export const clearTaskLogs = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}/logs`);
  invalidateTaskCaches();
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
  return getCached<AuthMeResponse>('/auth/me', { cacheTtlMs: 5000 });
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
  const data = await getCached<{ user: User }>('/users/me', { cacheTtlMs: 5000 });
  return data.user;
};

export const updateMe = async (params: { displayName?: string | null }): Promise<User> => {
  const { data } = await api.patch<{ user: User }>('/users/me', params);
  invalidateGetCache('/users/me');
  invalidateGetCache('/auth/me');
  return data.user;
};

export const changeMyPassword = async (params: { currentPassword: string; newPassword: string }): Promise<void> => {
  await api.patch('/users/me/password', params);
};

export interface UserModelCredentialsPublic {
  codex: UserModelProviderCredentialsPublic;
  claude_code: UserModelProviderCredentialsPublic;
  gemini_cli: UserModelProviderCredentialsPublic;
  gitlab: UserRepoProviderCredentialsPublic;
  github: UserRepoProviderCredentialsPublic;
  [key: string]: any;
}

export interface UserModelProviderCredentialProfilePublic {
  id: string;
  remark: string;
  apiBaseUrl?: string;
  hasApiKey: boolean;
}

export interface UserModelProviderCredentialsPublic {
  profiles: UserModelProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export interface UserRepoProviderCredentialProfilePublic {
  id: string;
  remark: string;
  hasToken: boolean;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentialsPublic {
  profiles: UserRepoProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export const fetchMyModelCredentials = async (): Promise<UserModelCredentialsPublic> => {
  const data = await getCached<{ credentials: UserModelCredentialsPublic }>('/users/me/model-credentials', {
    cacheTtlMs: 60000
  });
  return data.credentials;
};

export const updateMyModelCredentials = async (params: {
  codex?: {
    profiles?: Array<{
      id?: string | null;
      remark?: string | null;
      apiBaseUrl?: string | null;
      apiKey?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
  claude_code?: {
    profiles?: Array<{
      id?: string | null;
      remark?: string | null;
      apiBaseUrl?: string | null;
      apiKey?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
  gemini_cli?: {
    profiles?: Array<{
      id?: string | null;
      remark?: string | null;
      apiBaseUrl?: string | null;
      apiKey?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
  gitlab?: {
    profiles?: Array<{
      id?: string | null;
      remark?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
  github?: {
    profiles?: Array<{
      id?: string | null;
      remark?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
}): Promise<UserModelCredentialsPublic> => {
  const { data } = await api.patch<{ credentials: UserModelCredentialsPublic }>('/users/me/model-credentials', params);
  invalidateGetCache('/users/me/model-credentials');
  return data.credentials;
};

export type ModelProviderModelsSource = 'remote' | 'fallback';

export interface ModelProviderModelsResponse {
  models: string[];
  source: ModelProviderModelsSource;
}

export interface ModelProviderModelsRequest {
  provider: ModelProvider;
  profileId?: string;
  credential?: { apiBaseUrl?: string | null; apiKey?: string | null } | null;
  forceRefresh?: boolean;
}

export const listMyModelProviderModels = async (params: ModelProviderModelsRequest): Promise<ModelProviderModelsResponse> => {
  // Fetch provider models server-side so secrets never touch the browser runtime beyond form submission. b8fucnmey62u0muyn7i0
  const { data } = await api.post<ModelProviderModelsResponse>('/users/me/model-credentials/models', params);
  return data;
};

export const listRepoModelProviderModels = async (repoId: string, params: ModelProviderModelsRequest): Promise<ModelProviderModelsResponse> => {
  // Fetch repo-scoped provider models server-side to avoid hardcoding model lists in the UI. b8fucnmey62u0muyn7i0
  const { data } = await api.post<ModelProviderModelsResponse>(`/repos/${repoId}/model-credentials/models`, params);
  return data;
};

export interface AdminToolsMeta {
  enabled: boolean;
  ports: {
    prisma: number;
    swagger: number;
  };
}

export const fetchAdminToolsMeta = async (): Promise<AdminToolsMeta> => {
  return getCached<AdminToolsMeta>('/tools/meta', { cacheTtlMs: 30000 });
};

export const fetchSystemRuntimes = async (): Promise<SystemRuntimesResponse> => {
  // Fetch detected runtimes for the environment panel. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  return getCached<SystemRuntimesResponse>('/system/runtimes', { cacheTtlMs: 60000 });
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
  // Archived repositories are hidden from default lists and block new automation/tasks. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
  branches?: RepositoryBranch[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RobotPermission = 'read' | 'write';

export type ModelProvider = 'codex' | 'claude_code' | 'gemini_cli' | (string & {});

// Accept any Codex model id to support dynamic model discovery without hardcoded unions. b8fucnmey62u0muyn7i0
export type CodexModel = string;
export type CodexSandbox = 'workspace-write' | 'read-only';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface CodexRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  /**
   * Selected credential profile id when `credentialSource` is `user` or `repo`.
   *
   * Notes:
   * - Backend validates the existence and `hasApiKey` state for the chosen profile.
   */
  credentialProfileId?: string;
  /**
   * Inline robot credential (write-only for `apiKey`, safe for display for other fields).
   *
   * Notes:
   * - Only present when `credentialSource` is `robot`.
   */
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: CodexModel;
  sandbox: CodexSandbox;
  // Codex network access is always enabled and no longer part of the config payload. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
  model_reasoning_effort: CodexReasoningEffort;
}

export type ClaudeCodeSandbox = 'workspace-write' | 'read-only';

export interface ClaudeCodeRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credentialProfileId?: string;
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: string;
  sandbox: ClaudeCodeSandbox;
  sandbox_workspace_write: { network_access: boolean };
}

export type GeminiCliSandbox = 'workspace-write' | 'read-only';

export interface GeminiCliRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credentialProfileId?: string;
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: string;
  sandbox: GeminiCliSandbox;
  sandbox_workspace_write: { network_access: boolean };
}

export interface RepoScopedCredentialsPublic {
  // Business intent: repo-scoped credentials use the same "profile" shape as account credentials,
  // so the UI can reuse the same components for listing/editing defaults.
  repoProvider: UserRepoProviderCredentialsPublic;
  modelProvider: {
    codex: UserModelProviderCredentialsPublic;
    claude_code: UserModelProviderCredentialsPublic;
    gemini_cli: UserModelProviderCredentialsPublic;
  };
}

export interface RepoRobot {
  id: string;
  repoId: string;
  name: string;
  permission: RobotPermission;
  hasToken: boolean;
  repoCredentialSource?: 'robot' | 'user' | 'repo';
  repoCredentialProfileId?: string;
  repoCredentialRemark?: string;
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
  // Dependency overrides for multi-language installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyConfig?: { enabled?: boolean; failureMode?: 'soft' | 'hard'; allowCustomInstall?: boolean };
  defaultBranch?: string;
  // Compatibility: legacy field.
  defaultBranchRole?: 'main' | 'dev' | 'test';
  // Repo workflow mode selection (auto/direct/fork). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  repoWorkflowMode?: 'auto' | 'direct' | 'fork';
  // Optional hour-level execution window for this robot. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow;
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
  // Trigger-level scheduling window for this rule. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow;
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

export const listRepos = async (options?: { archived?: ArchiveScope }): Promise<Repository[]> => {
  // Cache repo lists briefly to dedupe repeated navigation between repo pages. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const data = await getCached<{ repos: Repository[] }>('/repos', { params: options, cacheTtlMs: 5000 });
  return data.repos;
};

export const archiveRepo = async (
  repoId: string
): Promise<{ repo: Repository; tasksArchived: number; taskGroupsArchived: number }> => {
  const { data } = await api.post<{ repo: Repository; tasksArchived: number; taskGroupsArchived: number }>(
    `/repos/${repoId}/archive`
  );
  // Keep repo/task caches aligned after archival mutates repo visibility and task groups. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
  invalidateTaskCaches();
  return data;
};

export const unarchiveRepo = async (
  repoId: string
): Promise<{ repo: Repository; tasksRestored: number; taskGroupsRestored: number }> => {
  const { data } = await api.post<{ repo: Repository; tasksRestored: number; taskGroupsRestored: number }>(
    `/repos/${repoId}/unarchive`
  );
  // Keep repo/task caches aligned after restoring archival state. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
  invalidateTaskCaches();
  return data;
};

export const listRepoRobots = async (repoId: string): Promise<RepoRobot[]> => {
  // Cache repo robot lists to reduce repeated robot picker loads. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const data = await getCached<{ robots: RepoRobot[] }>(`/repos/${repoId}/robots`, { cacheTtlMs: 5000 });
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
  // Refresh repo list caches after creating a new repository. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
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
  // Cache repo detail snapshots briefly to avoid N+1 summary storms. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const data = await getCached<{
    repo: Repository;
    robots: RepoRobot[];
    automationConfig: RepoAutomationConfig | null;
    webhookSecret?: string | null;
    webhookPath?: string;
    repoScopedCredentials?: RepoScopedCredentialsPublic;
  }>(`/repos/${id}`, { cacheTtlMs: 5000 });
  return data;
};

export type RepoProviderVisibility = 'public' | 'private' | 'internal' | 'unknown';

export const fetchRepoProviderMeta = async (
  repoId: string,
  params?: { credentialSource?: 'user' | 'repo' | 'anonymous'; credentialProfileId?: string }
): Promise<{ provider: RepoProvider; visibility: RepoProviderVisibility; webUrl?: string }> => {
  // Fetch provider metadata for repo onboarding (visibility, links) without leaking any credentials. 58w1q3n5nr58flmempxe
  // Cache provider meta briefly to reduce repeated visibility probes on page load. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  return getCached<{ provider: RepoProvider; visibility: RepoProviderVisibility; webUrl?: string }>(
    `/repos/${repoId}/provider-meta`,
    { params, cacheTtlMs: 15000 }
  );
};

export interface RepoProviderActivityItem {
  id: string;
  shortId?: string;
  title: string;
  url?: string;
  state?: string;
  time?: string;
  taskGroups?: Array<{
    id: string;
    kind: string;
    title?: string;
    updatedAt: string;
    processingTasks?: Array<{ id: string; status: string; title?: string; updatedAt?: string }>;
  }>;
}

export interface RepoProviderActivityPage {
  items: RepoProviderActivityItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface RepoProviderActivity {
  provider: RepoProvider;
  commits: RepoProviderActivityPage;
  merges: RepoProviderActivityPage;
  issues: RepoProviderActivityPage;
}

export const fetchRepoProviderActivity = async (
  repoId: string,
  params?: {
    credentialSource?: 'user' | 'repo' | 'anonymous';
    credentialProfileId?: string;
    pageSize?: number;
    commitsPage?: number;
    mergesPage?: number;
    issuesPage?: number;
    // Back-compat: legacy `limit` param is accepted by backend as pageSize when provided. kzxac35mxk0fg358i7zs
    limit?: number;
  }
): Promise<RepoProviderActivity> => {
  // Fetch provider activity for the repo detail dashboard row without exposing tokens to the browser. kzxac35mxk0fg358i7zs
  // Cache provider activity briefly to dedupe refreshes across columns and re-renders. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  return getCached<RepoProviderActivity>(`/repos/${repoId}/provider-activity`, { params, cacheTtlMs: 10000 });
};

export const listRepoWebhookDeliveries = async (
  repoId: string,
  params?: { limit?: number; cursor?: string }
): Promise<{ deliveries: RepoWebhookDeliverySummary[]; nextCursor?: string }> => {
  // Cache webhook delivery summaries briefly to avoid duplicate panel requests. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  return getCached<{ deliveries: RepoWebhookDeliverySummary[]; nextCursor?: string }>(
    `/repos/${repoId}/webhook-deliveries`,
    { params, cacheTtlMs: 5000 }
  );
};

export const fetchRepoWebhookDelivery = async (repoId: string, deliveryId: string): Promise<RepoWebhookDeliveryDetail> => {
  // Cache webhook delivery detail responses for quick reopen without refetching. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const data = await getCached<{ delivery: RepoWebhookDeliveryDetail }>(
    `/repos/${repoId}/webhook-deliveries/${deliveryId}`,
    { cacheTtlMs: 30000 }
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
          profiles?: Array<{
            id?: string | null;
            remark?: string | null;
            token?: string | null;
            cloneUsername?: string | null;
          }> | null;
          removeProfileIds?: string[] | null;
          defaultProfileId?: string | null;
        }
      | null;
    modelProviderCredential:
      | {
          codex?:
            | {
                profiles?: Array<{
                  id?: string | null;
                  remark?: string | null;
                  apiBaseUrl?: string | null;
                  apiKey?: string | null;
                }> | null;
                removeProfileIds?: string[] | null;
                defaultProfileId?: string | null;
              }
            | null;
          claude_code?:
            | {
                profiles?: Array<{
                  id?: string | null;
                  remark?: string | null;
                  apiBaseUrl?: string | null;
                  apiKey?: string | null;
                }> | null;
                removeProfileIds?: string[] | null;
                defaultProfileId?: string | null;
              }
            | null;
          gemini_cli?:
            | {
                profiles?: Array<{
                  id?: string | null;
                  remark?: string | null;
                  apiBaseUrl?: string | null;
                  apiKey?: string | null;
                }> | null;
                removeProfileIds?: string[] | null;
                defaultProfileId?: string | null;
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
  // Refresh repo caches after settings updates so list/detail views stay in sync. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
  return data;
};

export const createRepoRobot = async (
  repoId: string,
  params: {
    name: string;
    token?: string | null;
    repoCredentialSource?: 'robot' | 'user' | 'repo' | null;
    cloneUsername?: string | null;
    repoCredentialProfileId?: string | null;
    repoCredentialRemark?: string | null;
    promptDefault?: string | null;
    language?: string | null;
    modelProvider?: ModelProvider | null;
    modelProviderConfig?: unknown;
    // Dependency overrides for robot-level install control. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    dependencyConfig?: { enabled?: boolean; failureMode?: 'soft' | 'hard'; allowCustomInstall?: boolean } | null;
    defaultBranch?: string | null;
    // Compatibility: legacy field accepted by backend (main/dev/test).
    defaultBranchRole?: 'main' | 'dev' | 'test' | null;
    repoWorkflowMode?: 'auto' | 'direct' | 'fork' | null;
    // Optional execution window for robot-level scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    timeWindow?: TimeWindow | null;
    enabled?: boolean;
    isDefault?: boolean;
  }
): Promise<RepoRobot> => {
  const { data } = await api.post<{ robot: RepoRobot }>(`/repos/${repoId}/robots`, params);
  // Refresh repo caches after robot creation so pickers and summaries stay current. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
  return data.robot;
};

export const updateRepoRobot = async (
  repoId: string,
  robotId: string,
  params: Partial<{
    name: string;
    token: string | null;
    repoCredentialSource: 'robot' | 'user' | 'repo' | null;
    cloneUsername: string | null;
    repoCredentialProfileId: string | null;
    repoCredentialRemark: string | null;
    promptDefault: string | null;
    language: string | null;
    modelProvider: ModelProvider | null;
    modelProviderConfig: unknown;
    // Dependency overrides for robot-level install control. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    dependencyConfig: { enabled?: boolean; failureMode?: 'soft' | 'hard'; allowCustomInstall?: boolean } | null;
    defaultBranch: string | null;
    // Compatibility: legacy field accepted by backend (main/dev/test).
    defaultBranchRole: 'main' | 'dev' | 'test' | null;
    repoWorkflowMode: 'auto' | 'direct' | 'fork' | null;
    // Optional execution window for robot-level scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    timeWindow: TimeWindow | null;
    enabled: boolean;
    isDefault: boolean;
  }>
): Promise<RepoRobot> => {
  const { data } = await api.patch<{ robot: RepoRobot }>(`/repos/${repoId}/robots/${robotId}`, params);
  // Refresh repo caches after robot edits to keep robot lists consistent. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
  return data.robot;
};

export const testRepoRobot = async (
  repoId: string,
  robotId: string,
  params?: { branch?: string; reason?: string }
): Promise<{ ok: boolean; robot: RepoRobot; message?: string }> => {
  const { data } = await api.post<{ ok: boolean; robot: RepoRobot; message?: string }>(
    `/repos/${repoId}/robots/${robotId}/test`,
    params
  );
  // Refresh repo caches after robot test runs update metadata. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
  return data;
};

// Trigger a direct/fork workflow check for a robot configuration. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
export const testRepoRobotWorkflow = async (
  repoId: string,
  robotId: string,
  params?: { mode?: 'auto' | 'direct' | 'fork' | null }
): Promise<{ ok: boolean; mode: 'auto' | 'direct' | 'fork'; robot?: RepoRobot; message?: string }> => {
  const { data } = await api.post<{ ok: boolean; mode: 'auto' | 'direct' | 'fork'; robot?: RepoRobot; message?: string }>(
    `/repos/${repoId}/robots/${robotId}/workflow/test`,
    params
  );
  return data;
};

export const deleteRepoRobot = async (repoId: string, robotId: string): Promise<void> => {
  await api.delete(`/repos/${repoId}/robots/${robotId}`);
  // Refresh repo caches after robot deletion to avoid stale robot summaries. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
};

export const updateRepoAutomation = async (repoId: string, config: RepoAutomationConfig): Promise<RepoAutomationConfig> => {
  const { data } = await api.put<{ config: RepoAutomationConfig }>(`/repos/${repoId}/automation`, { config });
  // Refresh repo caches after automation edits so trigger summaries stay correct. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
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
  // Cache repo credential profiles briefly to avoid repeated settings requests. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const data = await getCached<{ profiles: RepoCredentialProfile[] }>(`/repos/${repoId}/credential-profiles`, {
    cacheTtlMs: 10000
  });
  return data.profiles;
};

export const createRepoCredentialProfile = async (
  repoId: string,
  params: { name: string; token?: string | null; cloneUsername?: string | null }
): Promise<{ profile: RepoCredentialProfile }> => {
  const { data } = await api.post<{ profile: RepoCredentialProfile }>(`/repos/${repoId}/credential-profiles`, params);
  // Refresh repo caches after profile creation to keep selectors current. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
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
  // Refresh repo caches after profile edits to avoid stale credential status. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
  return data;
};

export const deleteRepoCredentialProfile = async (repoId: string, profileId: string): Promise<void> => {
  await api.delete(`/repos/${repoId}/credential-profiles/${profileId}`);
  // Refresh repo caches after profile removal so lists update immediately. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateRepoCaches();
};
