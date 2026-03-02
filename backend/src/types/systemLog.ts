import { normalizeString } from '../utils/parse';

// Define system log types shared across modules and API responses. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export type SystemLogCategory = 'system' | 'operation' | 'execution';
export type SystemLogLevel = 'info' | 'warn' | 'error';

// Normalize system log categories/levels across persisted rows and query params. docs/en/developer/plans/systemlog-typefix-20260302/task_plan.md systemlog-typefix-20260302
export const SYSTEM_LOG_CATEGORIES: SystemLogCategory[] = ['system', 'operation', 'execution'];
export const SYSTEM_LOG_LEVELS: SystemLogLevel[] = ['info', 'warn', 'error'];

// Parse a category string into a typed value, returning undefined for invalid inputs. docs/en/developer/plans/systemlog-typefix-20260302/task_plan.md systemlog-typefix-20260302
export const normalizeSystemLogCategory = (value: unknown): SystemLogCategory | undefined => {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  return SYSTEM_LOG_CATEGORIES.includes(raw as SystemLogCategory) ? (raw as SystemLogCategory) : undefined;
};

// Parse a level string into a typed value, returning undefined for invalid inputs. docs/en/developer/plans/systemlog-typefix-20260302/task_plan.md systemlog-typefix-20260302
export const normalizeSystemLogLevel = (value: unknown): SystemLogLevel | undefined => {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  return SYSTEM_LOG_LEVELS.includes(raw as SystemLogLevel) ? (raw as SystemLogLevel) : undefined;
};

// Coerce persisted log values into typed defaults to keep API responses consistent. docs/en/developer/plans/systemlog-typefix-20260302/task_plan.md systemlog-typefix-20260302
export const coerceSystemLogCategory = (value: unknown, fallback: SystemLogCategory): SystemLogCategory =>
  normalizeSystemLogCategory(value) ?? fallback;

// Coerce persisted log values into typed defaults to keep API responses consistent. docs/en/developer/plans/systemlog-typefix-20260302/task_plan.md systemlog-typefix-20260302
export const coerceSystemLogLevel = (value: unknown, fallback: SystemLogLevel): SystemLogLevel =>
  normalizeSystemLogLevel(value) ?? fallback;

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
