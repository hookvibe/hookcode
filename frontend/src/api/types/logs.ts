// Define system log API types for the settings log tab. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export type SystemLogCategory = 'system' | 'operation' | 'execution';
export type SystemLogLevel = 'info' | 'warn' | 'error';

export interface SystemLogEntry {
  id: string;
  category: SystemLogCategory;
  level: SystemLogLevel;
  message: string;
  code?: string;
  actorUserId?: string;
  repoId?: string;
  taskId?: string;
  taskGroupId?: string;
  meta?: unknown;
  createdAt: string;
}

export interface ListSystemLogsResponse {
  logs: SystemLogEntry[];
  nextCursor?: string;
}
