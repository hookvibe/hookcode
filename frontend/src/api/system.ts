import { api, getCached, invalidateRepoCaches } from './client';
import type { AdminToolsMeta, GlobalRobot, PreviewAdminOverviewResponse, SystemRuntimesResponse, UserModelCredentialsPublic } from './types';

export type GlobalCredentialsPatchPayload = {
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
};

// Split system metadata APIs into a focused module for reuse. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const fetchAdminToolsMeta = async (): Promise<AdminToolsMeta> => {
  return getCached<AdminToolsMeta>('/tools/meta', { cacheTtlMs: 30000 });
};

export const fetchSystemRuntimes = async (): Promise<SystemRuntimesResponse> => {
  // Fetch detected runtimes for the environment panel. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  return getCached<SystemRuntimesResponse>('/system/runtimes', { cacheTtlMs: 60000 });
};

export const fetchPreviewAdminOverview = async (): Promise<PreviewAdminOverviewResponse> => {
  // Load global preview runtime + port allocation snapshots for the admin settings preview panel. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
  return getCached<PreviewAdminOverviewResponse>('/preview-admin/overview', { cacheTtlMs: 5000 });
};

export const fetchGlobalCredentials = async (): Promise<UserModelCredentialsPublic> => {
  return getCached<{ credentials: UserModelCredentialsPublic }>('/system/global-credentials', { cacheTtlMs: 5000 }).then((data) => data.credentials);
};

export const replaceGlobalCredentials = async (credentials: UserModelCredentialsPublic): Promise<UserModelCredentialsPublic> => {
  const { data } = await api.put<{ credentials: UserModelCredentialsPublic }>('/system/global-credentials', { credentials });
  invalidateRepoCaches();
  return data.credentials;
};

export const updateGlobalCredentials = async (params: GlobalCredentialsPatchPayload): Promise<UserModelCredentialsPublic> => {
  // Patch admin-managed global credential profiles without overwriting unchanged secrets. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const { data } = await api.patch<{ credentials: UserModelCredentialsPublic }>('/system/global-credentials', params);
  invalidateRepoCaches();
  return data.credentials;
};

export const listGlobalRobots = async (): Promise<GlobalRobot[]> => {
  return getCached<{ robots: GlobalRobot[] }>('/system/global-robots', { cacheTtlMs: 5000 }).then((data) => data.robots);
};

export const createGlobalRobot = async (params: Record<string, unknown>): Promise<GlobalRobot> => {
  const { data } = await api.post<{ robot: GlobalRobot }>('/system/global-robots', params);
  invalidateRepoCaches();
  return data.robot;
};

export const updateGlobalRobot = async (robotId: string, params: Record<string, unknown>): Promise<GlobalRobot> => {
  const { data } = await api.patch<{ robot: GlobalRobot }>(`/system/global-robots/${robotId}`, params);
  invalidateRepoCaches();
  return data.robot;
};

export const deleteGlobalRobot = async (robotId: string): Promise<void> => {
  await api.delete(`/system/global-robots/${robotId}`);
  invalidateRepoCaches();
};
