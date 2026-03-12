import { isUuidLike } from '../../utils/uuid';

export type SystemWorkerMode = 'local' | 'external' | 'disabled';

export interface ExternalSystemWorkerConfig {
  workerId: string;
  token: string;
}

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const readSystemWorkerMode = (env: NodeJS.ProcessEnv = process.env): SystemWorkerMode => {
  const raw = trimString(env.HOOKCODE_SYSTEM_WORKER_MODE).toLowerCase();
  // Normalize backend worker startup modes so source-mode defaults to the local supervisor while Docker/production can switch to external executors with one env. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  if (raw === 'external' || raw === 'remote') return 'external';
  if (raw === 'disabled' || raw === 'none' || raw === 'off') return 'disabled';
  return 'local';
};

export const readExternalSystemWorkerConfig = (env: NodeJS.ProcessEnv = process.env): ExternalSystemWorkerConfig | null => {
  const mode = readSystemWorkerMode(env);
  if (mode !== 'external') return null;

  const workerId = trimString(env.HOOKCODE_SYSTEM_WORKER_ID);
  const token = trimString(env.HOOKCODE_SYSTEM_WORKER_TOKEN);

  // Require only the existing worker credentials here because external mode now binds a pre-created remote worker instead of auto-registering one. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
  if (!workerId || !isUuidLike(workerId)) {
    throw new Error('HOOKCODE_SYSTEM_WORKER_ID must be a valid UUID when HOOKCODE_SYSTEM_WORKER_MODE=external');
  }
  if (!token) {
    throw new Error('HOOKCODE_SYSTEM_WORKER_TOKEN is required when HOOKCODE_SYSTEM_WORKER_MODE=external');
  }

  return { workerId, token };
};
