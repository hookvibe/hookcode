import { isTruthy } from '../utils/env';

// Read task log persistence toggle only from TASK_LOGS_DB_ENABLED to avoid legacy drift. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225
export const isTaskLogsDbEnabled = (): boolean => {
  if (process.env.TASK_LOGS_DB_ENABLED !== undefined) {
    return isTruthy(process.env.TASK_LOGS_DB_ENABLED, true);
  }
  return true;
};

// Read task log visibility toggle only from TASK_LOGS_VISIBLE_ENABLED to keep configuration explicit. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225
export const isTaskLogsVisibleEnabled = (): boolean => {
  if (process.env.TASK_LOGS_VISIBLE_ENABLED !== undefined) {
    return isTruthy(process.env.TASK_LOGS_VISIBLE_ENABLED, true);
  }
  return true;
};

// Treat "task logs enabled" as "persist AND visible" to avoid exposing empty logs when persistence is off. nykx5svtlgh050cstyht
export const isTaskLogsEnabled = (): boolean => isTaskLogsDbEnabled() && isTaskLogsVisibleEnabled();

// Feature toggle (2026-01-15):
// - Business context: Users / Account management.
// - Purpose: allow CI/staging deployments to disable self-service account editing (display name + password).
// - Notes: frontend also uses the same env var name as a UX hint; backend must enforce it as the security boundary.
export const isAccountEditDisabled = (): boolean => isTruthy(process.env.VITE_DISABLE_ACCOUNT_EDIT, false);
