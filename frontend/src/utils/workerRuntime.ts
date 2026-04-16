import type { WorkerProviderKey, WorkerRecord } from '../api';

export const WORKER_PROVIDER_KEYS: WorkerProviderKey[] = ['codex', 'claude_code', 'gemini_cli'];

const PROVIDER_LABELS: Record<WorkerProviderKey, string> = {
  codex: 'Codex',
  claude_code: 'Claude Code',
  gemini_cli: 'Gemini CLI'
};

export const getWorkerProviderLabel = (provider: WorkerProviderKey): string => PROVIDER_LABELS[provider];

export const normalizeWorkerProviderKey = (value: unknown): WorkerProviderKey | null => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return WORKER_PROVIDER_KEYS.find((provider) => provider === normalized) ?? null;
};

export const isWorkerProviderAvailable = (
  worker: Pick<WorkerRecord, 'providers'>,
  provider: WorkerProviderKey
): boolean => Array.isArray(worker.providers) && worker.providers.includes(provider);
