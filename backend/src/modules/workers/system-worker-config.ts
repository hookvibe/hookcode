export type SystemWorkerMode = 'local' | 'disabled';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const readSystemWorkerMode = (env: NodeJS.ProcessEnv = process.env): SystemWorkerMode => {
  const raw = trimString(env.HOOKCODE_SYSTEM_WORKER_MODE).toLowerCase();
  // Treat the old external/system-worker bootstrap mode as disabled so production deployments move to manually bound remote workers.
  if (raw === 'disabled' || raw === 'none' || raw === 'off') return 'disabled';
  if (raw === 'external' || raw === 'remote') return 'disabled';
  return 'local';
};
