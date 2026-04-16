import type {
  WorkerProviderKey,
  WorkerProviderRuntimeEntry,
  WorkerProviderRuntimeStatus,
  WorkerRecord,
  WorkerRuntimeState
} from '../api';

// Reuse one provider-readiness helper in worker settings and chat send guards so the UI blocks missing Codex/Claude/Gemini runtimes consistently. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
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

export const getWorkerProviderRuntimeEntry = (
  runtimeState: WorkerRuntimeState | null | undefined,
  provider: WorkerProviderKey
): WorkerProviderRuntimeEntry | undefined => {
  const direct = runtimeState?.providerStatuses?.[provider];
  if (direct) return direct;
  if (runtimeState?.preparingProviders?.includes(provider)) return { status: 'preparing' };
  if (runtimeState?.preparedProviders?.includes(provider)) return { status: 'ready' };
  return undefined;
};

export const getWorkerProviderRuntimeStatus = (
  worker: Pick<WorkerRecord, 'runtimeState' | 'capabilities'>,
  provider: WorkerProviderKey
): WorkerProviderRuntimeStatus => {
  const entry = getWorkerProviderRuntimeEntry(worker.runtimeState, provider);
  if (entry?.status) return entry.status;
  if (worker.capabilities?.providers?.includes(provider)) return 'ready';
  return 'idle';
};

export const isWorkerProviderReady = (
  worker: Pick<WorkerRecord, 'runtimeState' | 'capabilities'>,
  provider: WorkerProviderKey
): boolean => getWorkerProviderRuntimeStatus(worker, provider) === 'ready';

const hasKnownWorkerProviderRuntime = (
  worker: Pick<WorkerRecord, 'runtimeState' | 'capabilities'>
): boolean => {
  if (Array.isArray(worker.capabilities?.providers)) return true;
  if (worker.runtimeState?.providerStatuses) return true;
  if (Array.isArray(worker.runtimeState?.preparedProviders)) return true;
  if (Array.isArray(worker.runtimeState?.preparingProviders)) return true;
  return false;
};

export const getWorkerProviderGuardDetails = (params: {
  workerName: string;
  provider: WorkerProviderKey;
  worker: Pick<WorkerRecord, 'runtimeState' | 'capabilities'>;
}): { reason: 'preparing' | 'error' | 'missing'; providerLabel: string; workerName: string; error?: string } | null => {
  const status = getWorkerProviderRuntimeStatus(params.worker, params.provider);
  const providerLabel = getWorkerProviderLabel(params.provider);
  if (status === 'ready') return null;
  if (!hasKnownWorkerProviderRuntime(params.worker)) return null;
  if (status === 'preparing') return { reason: 'preparing', providerLabel, workerName: params.workerName };
  const error = getWorkerProviderRuntimeEntry(params.worker.runtimeState, params.provider)?.error?.trim();
  if (status === 'error') return { reason: 'error', providerLabel, workerName: params.workerName, error };
  return { reason: 'missing', providerLabel, workerName: params.workerName };
};
