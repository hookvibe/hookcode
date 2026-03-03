import { getCached } from './client';
import type { ListSystemLogsResponse, SystemLogCategory, SystemLogLevel } from './types';

export interface FetchSystemLogsParams {
  limit?: number;
  cursor?: string;
  category?: SystemLogCategory;
  level?: SystemLogLevel;
  repoId?: string;
  taskId?: string;
  taskGroupId?: string;
  q?: string;
}

// Fetch admin system logs for the settings log tab. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export const fetchSystemLogs = async (params?: FetchSystemLogsParams): Promise<ListSystemLogsResponse> => {
  return getCached<ListSystemLogsResponse>('/logs', { params, cacheTtlMs: 0 });
};
