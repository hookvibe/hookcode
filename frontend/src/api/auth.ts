import { api, getCached, invalidateGetCache } from './client';
import type { AuthMeResponse, User } from './types';
import type { AuthUser } from '../auth';

// Split authentication/profile APIs into a dedicated module for clarity. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const login = async (params: { username: string; password: string }): Promise<{
  token: string;
  expiresAt: string;
  user: AuthUser;
}> => {
  const { data } = await api.post<{ token: string; expiresAt: string; user: AuthUser }>('/auth/login', params);
  return data;
};

export const fetchAuthMe = async (): Promise<AuthMeResponse> => {
  return getCached<AuthMeResponse>('/auth/me', { cacheTtlMs: 5000 });
};

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
