// Shared provider-routing types and normalization helpers for the failover MVP. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const SUPPORTED_ROUTED_PROVIDER_KEYS = ['codex', 'claude_code', 'gemini_cli'] as const;

export type RoutedProviderKey = (typeof SUPPORTED_ROUTED_PROVIDER_KEYS)[number];
export type ProviderRoutingMode = 'fixed' | 'availability_first';
export type ProviderFailoverPolicy = 'disabled' | 'fallback_provider_once';
// Keep routing result enums aligned with credential resolution so global-scoped profiles can be surfaced end-to-end. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
export type ProviderStoredSource = 'robot' | 'repo' | 'user' | 'global';
export type ProviderResolutionLayer = 'local' | 'robot' | 'repo' | 'user' | 'global' | 'none';
export type ProviderResolutionMethod =
  | 'env_api_key'
  | 'credentials_file'
  | 'auth_json_tokens'
  | 'auth_json_api_key'
  | 'oauth_creds'
  | 'robot_embedded'
  | 'repo_profile'
  | 'global_profile'
  | 'user_profile'
  | 'none';

export interface ProviderRoutingConfig {
  mode: ProviderRoutingMode;
  fallbackProvider?: RoutedProviderKey;
  failoverPolicy: ProviderFailoverPolicy;
}

export interface ProviderRoutingCredentialSnapshot {
  requestedStoredSource: ProviderStoredSource;
  resolvedLayer: ProviderResolutionLayer;
  resolvedMethod: ProviderResolutionMethod;
  canExecute: boolean;
  profileId?: string;
  fallbackUsed: boolean;
  reason?: string;
}

export type ProviderRoutingAttemptRole = 'primary' | 'fallback';
export type ProviderRoutingAttemptStatus = 'planned' | 'skipped' | 'running' | 'succeeded' | 'failed';

export interface ProviderRoutingAttemptResult {
  provider: RoutedProviderKey;
  role: ProviderRoutingAttemptRole;
  status: ProviderRoutingAttemptStatus;
  reason?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  credential: ProviderRoutingCredentialSnapshot;
}

export interface ProviderRoutingResult {
  mode: ProviderRoutingMode;
  failoverPolicy: ProviderFailoverPolicy;
  primaryProvider: RoutedProviderKey;
  fallbackProvider?: RoutedProviderKey;
  selectedProvider: RoutedProviderKey;
  finalProvider?: RoutedProviderKey;
  selectionReason: string;
  failoverTriggered: boolean;
  attempts: ProviderRoutingAttemptResult[];
}

export const isRoutedProviderKey = (value: unknown): value is RoutedProviderKey =>
  typeof value === 'string' && (SUPPORTED_ROUTED_PROVIDER_KEYS as readonly string[]).includes(value);

export const normalizeRoutedProviderKey = (value: unknown): RoutedProviderKey | undefined => {
  const raw = safeTrim(value).toLowerCase();
  return isRoutedProviderKey(raw) ? raw : undefined;
};

export const getDefaultProviderRoutingConfig = (): ProviderRoutingConfig => ({
  mode: 'fixed',
  failoverPolicy: 'disabled'
});

export const normalizeProviderRoutingConfig = (
  raw: unknown,
  primaryProvider: RoutedProviderKey
): ProviderRoutingConfig => {
  const base = getDefaultProviderRoutingConfig();
  if (!isRecord(raw)) return base;

  const modeRaw = safeTrim(raw.mode).toLowerCase();
  const failoverPolicyRaw = safeTrim(raw.failoverPolicy).toLowerCase();
  const fallbackProviderRaw = normalizeRoutedProviderKey(raw.fallbackProvider);
  const fallbackProvider = fallbackProviderRaw && fallbackProviderRaw !== primaryProvider ? fallbackProviderRaw : undefined;
  const mode: ProviderRoutingMode = modeRaw === 'availability_first' ? 'availability_first' : 'fixed';
  const failoverPolicy: ProviderFailoverPolicy =
    fallbackProvider && failoverPolicyRaw === 'fallback_provider_once' ? 'fallback_provider_once' : 'disabled';

  return {
    mode,
    fallbackProvider,
    failoverPolicy
  };
};
