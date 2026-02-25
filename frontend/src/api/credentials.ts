import { api, getCached, invalidateGetCache } from './client';
import type {
  ApiTokenScope,
  ModelProviderModelsRequest,
  ModelProviderModelsResponse,
  UserApiTokenPublic,
  UserModelCredentialsPublic
} from './types';

// Split model credential and API token APIs into a dedicated module. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
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

export const fetchMyApiTokens = async (): Promise<UserApiTokenPublic[]> => {
  const data = await getCached<{ tokens: UserApiTokenPublic[] }>('/users/me/api-tokens', { cacheTtlMs: 30000 });
  return data.tokens;
};

export const createMyApiToken = async (params: {
  name: string;
  scopes: ApiTokenScope[];
  expiresInDays?: number | null;
}): Promise<{ token: string; apiToken: UserApiTokenPublic }> => {
  const { data } = await api.post<{ token: string; apiToken: UserApiTokenPublic }>('/users/me/api-tokens', params);
  invalidateGetCache('/users/me/api-tokens');
  return data;
};

export const updateMyApiToken = async (
  id: string,
  params: { name?: string; scopes?: ApiTokenScope[]; expiresInDays?: number | null }
): Promise<UserApiTokenPublic> => {
  const { data } = await api.patch<{ apiToken: UserApiTokenPublic }>(`/users/me/api-tokens/${id}`, params);
  invalidateGetCache('/users/me/api-tokens');
  return data.apiToken;
};

export const revokeMyApiToken = async (id: string): Promise<UserApiTokenPublic> => {
  const { data } = await api.post<{ apiToken: UserApiTokenPublic }>(`/users/me/api-tokens/${id}/revoke`);
  invalidateGetCache('/users/me/api-tokens');
  return data.apiToken;
};

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
