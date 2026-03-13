import { api, getCached, invalidateRepoCaches, invalidateTaskCaches } from './client';
import type {
  ArchiveScope,
  ModelProvider,
  RepoAutomationConfig,
  RepoCredentialProfile,
  RepoInvite,
  RepoMember,
  RepoProvider,
  RepoProviderActivity,
  RepoProviderVisibility,
  RepoRole,
  RepoRobot,
  RepoRobotDryRunRequest,
  RepoRobotDryRunResponse,
  RepoPreviewEnvConfigPublic,
  RepoScopedCredentialsPublic,
  RepoWebhookDeliveryDetail,
  RepoWebhookDeliverySummary,
  RepoListResponse,
  Repository,
  RepositoryBranch,
  TimeWindow
} from './types';

// Split repository, robot, automation, and webhook-delivery APIs into a dedicated module. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const listRepos = async (options?: { archived?: ArchiveScope; limit?: number; cursor?: string }): Promise<RepoListResponse> => {
  // Add cursor-aware repo list retrieval for paginated UI loads. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  // Cache repo lists briefly to dedupe repeated navigation between repo pages. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  return getCached<RepoListResponse>('/repos', { params: options, cacheTtlMs: 5000 });
};

export const fetchAllRepos = async (options?: { archived?: ArchiveScope }): Promise<Repository[]> => {
  // Load all repo pages for selectors that require the full repository list. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const collected: Repository[] = [];
  let cursor: string | undefined;
  do {
    const { repos, nextCursor } = await listRepos({ ...(options ?? {}), limit: 50, cursor });
    const existing = new Set(collected.map((repo) => repo.id));
    collected.push(...repos.filter((repo) => !existing.has(repo.id)));
    cursor = nextCursor;
  } while (cursor);
  return collected;
};

export const deleteRepo = async (repoId: string): Promise<Repository> => {
  const { data } = await api.delete<{ repo: Repository }>(`/repos/${repoId}`);
  // Refresh repo/task caches after deleting a repository. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  invalidateRepoCaches();
  invalidateTaskCaches();
  return data.repo;
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
  previewEnvConfig?: RepoPreviewEnvConfigPublic;
}> => {
  // Cache repo detail snapshots briefly to avoid N+1 summary storms. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const data = await getCached<{
    repo: Repository;
    robots: RepoRobot[];
    automationConfig: RepoAutomationConfig | null;
    webhookSecret?: string | null;
    webhookPath?: string;
    repoScopedCredentials?: RepoScopedCredentialsPublic;
    previewEnvConfig?: RepoPreviewEnvConfigPublic;
  }>(`/repos/${id}`, { cacheTtlMs: 5000 });
  return data;
};

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
    // Patch repo-scoped preview env vars (write-only secrets). docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    previewEnvConfig:
      | {
          entries?: Array<{
            key?: string | null;
            value?: string | null;
            secret?: boolean | null;
          }> | null;
          removeKeys?: string[] | null;
        }
      | null;
  }>
): Promise<{
  repo: Repository;
  repoScopedCredentials?: RepoScopedCredentialsPublic;
  previewEnvConfig?: RepoPreviewEnvConfigPublic;
}> => {
  const { data } = await api.patch<{
    repo: Repository;
    repoScopedCredentials?: RepoScopedCredentialsPublic;
    previewEnvConfig?: RepoPreviewEnvConfigPublic;
  }>(`/repos/${id}`, params);
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
    // Persist robot-level worker defaults so repo automation can route new tasks explicitly. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    defaultWorkerId?: string | null;
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
    defaultWorkerId: string | null;
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

// Call the robot playground API with either a saved robot id or an unsaved draft route. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
export const dryRunRepoRobot = async (
  repoId: string,
  params: RepoRobotDryRunRequest,
  robotId?: string | null
): Promise<RepoRobotDryRunResponse> => {
  const path = robotId ? `/repos/${repoId}/robots/${robotId}/dry-run` : `/repos/${repoId}/robots/dry-run`;
  const { data } = await api.post<RepoRobotDryRunResponse>(path, params);
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

// Trigger a workflow check without saving a robot by using the currently selected credentials. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
export const testRepoWorkflow = async (
  repoId: string,
  params?: {
    mode?: 'auto' | 'direct' | 'fork' | null;
    repoCredentialSource?: 'robot' | 'user' | 'repo' | null;
    repoCredentialProfileId?: string | null;
    token?: string | null;
    permission?: 'read' | 'write' | null;
  }
): Promise<{ ok: boolean; mode: 'auto' | 'direct' | 'fork'; message?: string }> => {
  const { data } = await api.post<{ ok: boolean; mode: 'auto' | 'direct' | 'fork'; message?: string }>(
    `/repos/${repoId}/workflow/test`,
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

// Add repo member/invite APIs for RBAC management UI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export const listRepoMembers = async (repoId: string): Promise<RepoMember[]> => {
  const data = await getCached<{ members: RepoMember[] }>(`/repos/${repoId}/members`, { cacheTtlMs: 5000 });
  return data.members;
};

export const updateRepoMemberRole = async (repoId: string, userId: string, role: RepoRole): Promise<void> => {
  await api.patch(`/repos/${repoId}/members/${userId}`, { role });
};

export const removeRepoMember = async (repoId: string, userId: string): Promise<void> => {
  await api.delete(`/repos/${repoId}/members/${userId}`);
};

export const listRepoInvites = async (repoId: string): Promise<RepoInvite[]> => {
  const data = await getCached<{ invites: RepoInvite[] }>(`/repos/${repoId}/invites`, { cacheTtlMs: 5000 });
  return data.invites;
};

export const createRepoInvite = async (repoId: string, params: { email: string; role: RepoRole }): Promise<RepoInvite> => {
  const { data } = await api.post<{ invite: RepoInvite }>(`/repos/${repoId}/invites`, params);
  return data.invite;
};

export const revokeRepoInvite = async (repoId: string, inviteId: string): Promise<void> => {
  await api.delete(`/repos/${repoId}/invites/${inviteId}`);
};

export const acceptRepoInvite = async (params: { email: string; token: string }): Promise<{ repoId: string }> => {
  const { data } = await api.post<{ repoId: string }>(`/repos/invites/accept`, params);
  return data;
};
