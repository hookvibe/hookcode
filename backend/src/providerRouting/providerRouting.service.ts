// Build runtime provider-routing plans without changing the underlying task runner contract. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
import {
  CODEX_PROVIDER_KEY,
  getDefaultCodexRobotProviderConfig,
  normalizeCodexRobotProviderConfig
} from '../modelProviders/codex';
import {
  CLAUDE_CODE_PROVIDER_KEY,
  getDefaultClaudeCodeRobotProviderConfig,
  normalizeClaudeCodeRobotProviderConfig
} from '../modelProviders/claudeCode';
import {
  GEMINI_CLI_PROVIDER_KEY,
  getDefaultGeminiCliRobotProviderConfig,
  normalizeGeminiCliRobotProviderConfig
} from '../modelProviders/geminiCli';
import {
  resolveProviderExecutionCredential,
  type ResolvedProviderCredentialSummary
} from '../modelProviders/providerCredentialResolver';
import type { RepoScopedModelProviderCredentials } from '../modules/repositories/repository.service';
import type { UserModelCredentials } from '../modules/users/user.service';
import {
  normalizeProviderRoutingConfig,
  type ProviderFailoverPolicy,
  type ProviderResolutionLayer,
  type ProviderResolutionMethod,
  type ProviderRoutingAttemptResult,
  type ProviderRoutingConfig,
  type ProviderRoutingResult,
  type ProviderStoredSource,
  type RoutedProviderKey
} from './providerRouting.types';

type RoutingCredentialPreview = {
  requestedStoredSource: ProviderStoredSource;
  resolvedLayer: ProviderResolutionLayer;
  resolvedMethod: ProviderResolutionMethod;
  canExecute: boolean;
  profileId?: string;
  fallbackUsed: boolean;
  reason?: string;
};

export interface ProviderRoutingAttemptPlan {
  provider: RoutedProviderKey;
  role: 'primary' | 'fallback';
  providerConfigRaw: unknown;
  credentialPreview: RoutingCredentialPreview;
}

export interface ProviderRoutingPlan {
  routingConfig: ProviderRoutingConfig;
  primaryProvider: RoutedProviderKey;
  fallbackProvider?: RoutedProviderKey;
  selectedProvider: RoutedProviderKey;
  selectionReason: string;
  failoverPolicy: ProviderFailoverPolicy;
  attempts: ProviderRoutingAttemptPlan[];
}

type ResolveCredentialFn = typeof resolveProviderExecutionCredential;

const toCredentialPreview = (resolved: ResolvedProviderCredentialSummary): RoutingCredentialPreview => ({
  requestedStoredSource: resolved.requestedStoredSource,
  resolvedLayer: resolved.resolvedLayer,
  resolvedMethod: resolved.resolvedMethod,
  canExecute: resolved.canExecute,
  profileId: resolved.profileId,
  fallbackUsed: resolved.fallbackUsed,
  reason: resolved.reason
});

const deriveFallbackStoredSource = (primaryProvider: RoutedProviderKey, primaryConfigRaw: unknown): ProviderStoredSource => {
  if (primaryProvider === CODEX_PROVIDER_KEY) {
    const cfg = normalizeCodexRobotProviderConfig(primaryConfigRaw);
    return cfg.credentialSource === 'robot' ? 'user' : cfg.credentialSource;
  }
  if (primaryProvider === CLAUDE_CODE_PROVIDER_KEY) {
    const cfg = normalizeClaudeCodeRobotProviderConfig(primaryConfigRaw);
    return cfg.credentialSource === 'robot' ? 'user' : cfg.credentialSource;
  }
  const cfg = normalizeGeminiCliRobotProviderConfig(primaryConfigRaw);
  return cfg.credentialSource === 'robot' ? 'user' : cfg.credentialSource;
};

const deriveFallbackSandbox = (
  primaryProvider: RoutedProviderKey,
  primaryConfigRaw: unknown
): 'read-only' | 'workspace-write' => {
  if (primaryProvider === CODEX_PROVIDER_KEY) return normalizeCodexRobotProviderConfig(primaryConfigRaw).sandbox;
  if (primaryProvider === CLAUDE_CODE_PROVIDER_KEY) return normalizeClaudeCodeRobotProviderConfig(primaryConfigRaw).sandbox;
  return normalizeGeminiCliRobotProviderConfig(primaryConfigRaw).sandbox;
};

const deriveFallbackNetworkAccess = (primaryProvider: RoutedProviderKey, primaryConfigRaw: unknown): boolean => {
  if (primaryProvider === CODEX_PROVIDER_KEY) {
    return normalizeCodexRobotProviderConfig(primaryConfigRaw).sandbox === 'workspace-write';
  }
  if (primaryProvider === CLAUDE_CODE_PROVIDER_KEY) {
    const cfg = normalizeClaudeCodeRobotProviderConfig(primaryConfigRaw);
    return cfg.sandbox === 'workspace-write' && cfg.sandbox_workspace_write.network_access;
  }
  const cfg = normalizeGeminiCliRobotProviderConfig(primaryConfigRaw);
  return cfg.sandbox === 'workspace-write' && cfg.sandbox_workspace_write.network_access;
};

export const buildFallbackProviderConfigRaw = (params: {
  provider: RoutedProviderKey;
  primaryProvider: RoutedProviderKey;
  primaryConfigRaw: unknown;
}): unknown => {
  const credentialSource = deriveFallbackStoredSource(params.primaryProvider, params.primaryConfigRaw);
  const sandbox = deriveFallbackSandbox(params.primaryProvider, params.primaryConfigRaw);
  const networkAccess = deriveFallbackNetworkAccess(params.primaryProvider, params.primaryConfigRaw);

  if (params.provider === CODEX_PROVIDER_KEY) {
    return {
      ...getDefaultCodexRobotProviderConfig(),
      credentialSource,
      credentialProfileId: undefined,
      credential: undefined,
      sandbox,
      routingConfig: {
        failoverPolicy: 'disabled',
        mode: 'fixed'
      }
    };
  }

  if (params.provider === CLAUDE_CODE_PROVIDER_KEY) {
    return {
      ...getDefaultClaudeCodeRobotProviderConfig(),
      credentialSource,
      credentialProfileId: undefined,
      credential: undefined,
      sandbox,
      sandbox_workspace_write: {
        network_access: sandbox === 'workspace-write' && networkAccess
      },
      routingConfig: {
        failoverPolicy: 'disabled',
        mode: 'fixed'
      }
    };
  }

  return {
    ...getDefaultGeminiCliRobotProviderConfig(),
    credentialSource,
    credentialProfileId: undefined,
    credential: undefined,
    sandbox,
    sandbox_workspace_write: {
      network_access: sandbox === 'workspace-write' && networkAccess
    },
    routingConfig: {
      failoverPolicy: 'disabled',
      mode: 'fixed'
    }
  };
};

export const toProviderRoutingResult = (plan: ProviderRoutingPlan): ProviderRoutingResult => ({
  mode: plan.routingConfig.mode,
  failoverPolicy: plan.failoverPolicy,
  primaryProvider: plan.primaryProvider,
  fallbackProvider: plan.fallbackProvider,
  selectedProvider: plan.selectedProvider,
  selectionReason: plan.selectionReason,
  failoverTriggered: false,
  attempts: plan.attempts.map<ProviderRoutingAttemptResult>((attempt) => ({
    provider: attempt.provider,
    role: attempt.role,
    status:
      attempt.provider === plan.selectedProvider
        ? 'planned'
        : attempt.role === 'primary' && plan.selectedProvider !== plan.primaryProvider
          ? 'skipped'
          : 'planned',
    reason:
      attempt.provider === plan.selectedProvider
        ? 'Selected for execution.'
        : attempt.role === 'primary' && plan.selectedProvider !== plan.primaryProvider
          ? 'Skipped before execution because availability-first routing selected the fallback provider.'
          : 'Waiting for failover.',
    credential: attempt.credentialPreview
  }))
});

export const updateProviderRoutingAttempt = (
  result: ProviderRoutingResult,
  provider: RoutedProviderKey,
  patch: Partial<ProviderRoutingAttemptResult>
): ProviderRoutingResult => ({
  ...result,
  attempts: result.attempts.map((attempt) => (attempt.provider === provider ? { ...attempt, ...patch } : attempt))
});

export const buildProviderRoutingPlan = async (
  params: {
    primaryProvider: RoutedProviderKey;
    primaryConfigRaw: unknown;
    userCredentials?: UserModelCredentials | null;
    repoScopedCredentials?: RepoScopedModelProviderCredentials | null;
    __internal?: {
      resolveCredential?: ResolveCredentialFn;
    };
  }
): Promise<ProviderRoutingPlan> => {
  const resolveCredential = params.__internal?.resolveCredential ?? resolveProviderExecutionCredential;
  const routingConfig = normalizeProviderRoutingConfig(
    (params.primaryConfigRaw as Record<string, unknown> | null | undefined)?.routingConfig,
    params.primaryProvider
  );

  const primaryResolved = await resolveCredential({
    provider: params.primaryProvider,
    robotConfigRaw: params.primaryConfigRaw,
    userCredentials: params.userCredentials,
    repoScopedCredentials: params.repoScopedCredentials
  });

  const attempts: ProviderRoutingAttemptPlan[] = [
    {
      provider: params.primaryProvider,
      role: 'primary',
      providerConfigRaw: params.primaryConfigRaw,
      credentialPreview: toCredentialPreview(primaryResolved)
    }
  ];

  let fallbackResolved: ResolvedProviderCredentialSummary | null = null;
  let fallbackConfigRaw: unknown = null;
  if (routingConfig.fallbackProvider) {
    fallbackConfigRaw = buildFallbackProviderConfigRaw({
      provider: routingConfig.fallbackProvider,
      primaryProvider: params.primaryProvider,
      primaryConfigRaw: params.primaryConfigRaw
    });
    fallbackResolved = await resolveCredential({
      provider: routingConfig.fallbackProvider,
      robotConfigRaw: fallbackConfigRaw,
      userCredentials: params.userCredentials,
      repoScopedCredentials: params.repoScopedCredentials
    });
    attempts.push({
      provider: routingConfig.fallbackProvider,
      role: 'fallback',
      providerConfigRaw: fallbackConfigRaw,
      credentialPreview: toCredentialPreview(fallbackResolved)
    });
  }

  if (routingConfig.mode === 'availability_first' && !primaryResolved.canExecute && fallbackResolved?.canExecute && routingConfig.fallbackProvider) {
    return {
      routingConfig,
      primaryProvider: params.primaryProvider,
      fallbackProvider: routingConfig.fallbackProvider,
      selectedProvider: routingConfig.fallbackProvider,
      selectionReason: 'Primary provider had no executable credential, so availability-first routing selected the fallback provider.',
      failoverPolicy: routingConfig.failoverPolicy,
      attempts
    };
  }

  return {
    routingConfig,
    primaryProvider: params.primaryProvider,
    fallbackProvider: routingConfig.fallbackProvider,
    selectedProvider: params.primaryProvider,
    selectionReason: 'Primary provider is configured on the robot and will run first.',
    failoverPolicy: routingConfig.failoverPolicy,
    attempts
  };
};
