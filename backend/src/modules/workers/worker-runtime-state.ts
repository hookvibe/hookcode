import type {
  WorkerCapabilities,
  WorkerProviderKey,
  WorkerProviderRuntimeEntry,
  WorkerProviderRuntimeStatuses,
  WorkerRuntimeState
} from '../../types/worker';

// Centralize worker provider runtime state derivation so task gating and admin UI persistence share one Codex/Claude/Gemini readiness contract. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
export const WORKER_PROVIDER_KEYS: WorkerProviderKey[] = ['codex', 'claude_code', 'gemini_cli'];

const PROVIDER_LABELS: Record<WorkerProviderKey, string> = {
  codex: 'Codex',
  claude_code: 'Claude Code',
  gemini_cli: 'Gemini CLI'
};

const cloneProviderStatuses = (value?: WorkerProviderRuntimeStatuses | null): WorkerProviderRuntimeStatuses => {
  const next: WorkerProviderRuntimeStatuses = {};
  for (const provider of WORKER_PROVIDER_KEYS) {
    if (!value?.[provider]) continue;
    next[provider] = { ...value[provider] };
  }
  return next;
};

const resolveAvailableProvidersFromStatuses = (statuses: WorkerProviderRuntimeStatuses): WorkerProviderKey[] =>
  WORKER_PROVIDER_KEYS.filter((provider) => statuses[provider]?.status === 'ready');

const resolveLastCheckErrorFromStatuses = (statuses: WorkerProviderRuntimeStatuses): string | undefined => {
  const messages = WORKER_PROVIDER_KEYS
    .map((provider) => {
      const entry = statuses[provider];
      const error = typeof entry?.error === 'string' ? entry.error.trim() : '';
      if (!error) return '';
      return `${PROVIDER_LABELS[provider]}: ${error}`;
    })
    .filter(Boolean);
  return messages.length ? messages.join(' | ') : undefined;
};

export const normalizeWorkerProviderKey = (value: unknown): WorkerProviderKey | null => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return WORKER_PROVIDER_KEYS.find((provider) => provider === normalized) ?? null;
};

export const listAvailableWorkerProviders = (
  runtimeState?: WorkerRuntimeState | null,
  capabilities?: WorkerCapabilities | null
): WorkerProviderKey[] => {
  const providerStatuses = cloneProviderStatuses(runtimeState?.providerStatuses);
  const fromAvailableProviders = Array.isArray(runtimeState?.availableProviders)
    ? runtimeState.availableProviders.map((provider) => normalizeWorkerProviderKey(provider)).filter(Boolean)
    : [];
  if (fromAvailableProviders.length > 0) return Array.from(new Set(fromAvailableProviders)) as WorkerProviderKey[];
  const fromStatuses = resolveAvailableProvidersFromStatuses(providerStatuses);
  if (fromStatuses.length > 0) return fromStatuses;
  const fromCapabilities = Array.isArray(capabilities?.providers)
    ? capabilities.providers.map((provider) => normalizeWorkerProviderKey(provider)).filter(Boolean)
    : [];
  return Array.from(new Set(fromCapabilities)) as WorkerProviderKey[];
};

export const getWorkerProviderRuntimeEntry = (
  runtimeState: WorkerRuntimeState | null | undefined,
  provider: WorkerProviderKey
): WorkerProviderRuntimeEntry | undefined => {
  const direct = runtimeState?.providerStatuses?.[provider];
  if (direct) return direct;
  if (runtimeState?.availableProviders?.includes(provider)) return { status: 'ready' };
  return undefined;
};

export const mergeWorkerRuntimeState = (
  priorState?: WorkerRuntimeState | null,
  nextState?: WorkerRuntimeState | null
): WorkerRuntimeState | undefined => {
  if (!priorState && !nextState) return undefined;
  const providerStatuses: WorkerProviderRuntimeStatuses = {
    ...cloneProviderStatuses(priorState?.providerStatuses),
    ...cloneProviderStatuses(nextState?.providerStatuses)
  };
  for (const provider of priorState?.availableProviders ?? []) {
    const normalized = normalizeWorkerProviderKey(provider);
    if (!normalized || providerStatuses[normalized]) continue;
    providerStatuses[normalized] = { status: 'ready' };
  }
  for (const provider of nextState?.availableProviders ?? []) {
    const normalized = normalizeWorkerProviderKey(provider);
    if (!normalized) continue;
    providerStatuses[normalized] = {
      ...providerStatuses[normalized],
      status: 'ready',
      error: undefined
    };
  }
  const availableProviders = resolveAvailableProvidersFromStatuses(providerStatuses);
  const lastCheckError =
    resolveLastCheckErrorFromStatuses(providerStatuses) ??
    nextState?.lastCheckError ??
    priorState?.lastCheckError;

  return {
    ...priorState,
    ...nextState,
    providerStatuses,
    availableProviders,
    lastCheckedAt: nextState?.lastCheckedAt ?? priorState?.lastCheckedAt,
    lastCheckError
  };
};

export const buildWorkerProviderNotReadyMessage = (
  workerName: string,
  provider: WorkerProviderKey,
  reason: 'missing' | 'error'
): string => {
  const providerLabel = PROVIDER_LABELS[provider];
  if (reason === 'error') {
    return `${providerLabel} is unavailable on ${workerName}. Fix the CLI environment on that machine before starting the task.`;
  }
  return `${providerLabel} is not available in ${workerName}'s environment. Install or configure the global ${providerLabel} CLI on that machine before starting the task.`;
};
