export type SystemWorkerMode = 'local' | 'disabled';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const readSystemWorkerMode = (env: NodeJS.ProcessEnv = process.env): SystemWorkerMode => {
  const raw = trimString(env.HOOKCODE_SYSTEM_WORKER_MODE).toLowerCase();
  // Treat legacy external-mode values as disabled so Docker/CI deployments stop auto-starting or auto-binding workers unexpectedly. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
  if (raw === 'disabled' || raw === 'none' || raw === 'off' || raw === 'external' || raw === 'remote') return 'disabled';
  return 'local';
};
