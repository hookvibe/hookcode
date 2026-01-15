import { isTruthy } from '../utils/env';

export const isTaskLogsEnabled = (): boolean => isTruthy(process.env.TASK_LOGS_ENABLED, false);

// Feature toggle (2026-01-15):
// - Business context: Users / Account management.
// - Purpose: allow CI/staging deployments to disable self-service account editing (display name + password).
// - Notes: frontend also uses the same env var name as a UX hint; backend must enforce it as the security boundary.
export const isAccountEditDisabled = (): boolean => isTruthy(process.env.VITE_DISABLE_ACCOUNT_EDIT, false);
