import { getCached } from './client';
import type { AdminToolsMeta, SystemRuntimesResponse } from './types';

// Split system metadata APIs into a focused module for reuse. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const fetchAdminToolsMeta = async (): Promise<AdminToolsMeta> => {
  return getCached<AdminToolsMeta>('/tools/meta', { cacheTtlMs: 30000 });
};

export const fetchSystemRuntimes = async (): Promise<SystemRuntimesResponse> => {
  // Fetch detected runtimes for the environment panel. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  return getCached<SystemRuntimesResponse>('/system/runtimes', { cacheTtlMs: 60000 });
};
