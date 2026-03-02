// Define system log types shared across modules and API responses. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
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
