import { getCached } from './client';
import type { AdminToolsMeta, PreviewAdminOverviewResponse, SystemRuntimesResponse } from './types';

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
