import {
  CODEX_PROVIDER_KEY,
  normalizeCodexRobotProviderConfig
} from '../modelProviders/codex';
import {
  CLAUDE_CODE_PROVIDER_KEY,
  normalizeClaudeCodeRobotProviderConfig
} from '../modelProviders/claudeCode';
import {
  GEMINI_CLI_PROVIDER_KEY,
  normalizeGeminiCliRobotProviderConfig
} from '../modelProviders/geminiCli';
import { buildFallbackProviderConfigRaw } from '../providerRouting/providerRouting.service';
import type { RoutedProviderKey } from '../providerRouting/providerRouting.types';
import type { BudgetExecutionOverride } from './types';

export const resolveModelFromProviderConfig = (provider: RoutedProviderKey, rawConfig: unknown): string | undefined => {
  if (provider === CODEX_PROVIDER_KEY) return normalizeCodexRobotProviderConfig(rawConfig).model;
  if (provider === CLAUDE_CODE_PROVIDER_KEY) return normalizeClaudeCodeRobotProviderConfig(rawConfig).model;
  return normalizeGeminiCliRobotProviderConfig(rawConfig).model;
};

export const applyBudgetExecutionOverride = (params: {
  primaryProvider: RoutedProviderKey;
  primaryConfigRaw: unknown;
  override?: BudgetExecutionOverride;
}): { provider: RoutedProviderKey; configRaw: unknown } => {
  const override = params.override;
  if (!override) {
    return { provider: params.primaryProvider, configRaw: params.primaryConfigRaw };
  }

  let provider = params.primaryProvider;
  let configRaw = params.primaryConfigRaw;

  if (override.provider && override.provider !== provider) {
    configRaw = buildFallbackProviderConfigRaw({
      provider: override.provider,
      primaryProvider: params.primaryProvider,
      primaryConfigRaw: params.primaryConfigRaw
    });
    provider = override.provider;
  }

  if (provider === CODEX_PROVIDER_KEY) {
    const normalized = normalizeCodexRobotProviderConfig(configRaw);
    return {
      provider,
      configRaw: {
        ...normalized,
        model: override.model || normalized.model,
        sandbox: override.forceReadOnly ? 'read-only' : normalized.sandbox,
        routingConfig: { mode: 'fixed', failoverPolicy: 'disabled' }
      }
    };
  }

  if (provider === CLAUDE_CODE_PROVIDER_KEY) {
    const normalized = normalizeClaudeCodeRobotProviderConfig(configRaw);
    const readOnly = override.forceReadOnly ? 'read-only' : normalized.sandbox;
    return {
      provider,
      configRaw: {
        ...normalized,
        model: override.model || normalized.model,
        sandbox: readOnly,
        sandbox_workspace_write: {
          network_access: readOnly === 'workspace-write' && normalized.sandbox_workspace_write.network_access
        },
        routingConfig: { mode: 'fixed', failoverPolicy: 'disabled' }
      }
    };
  }

  const normalized = normalizeGeminiCliRobotProviderConfig(configRaw);
  const readOnly = override.forceReadOnly ? 'read-only' : normalized.sandbox;
  return {
    provider,
    configRaw: {
      ...normalized,
      model: override.model || normalized.model,
      sandbox: readOnly,
      sandbox_workspace_write: {
        network_access: readOnly === 'workspace-write' && normalized.sandbox_workspace_write.network_access
      },
      routingConfig: { mode: 'fixed', failoverPolicy: 'disabled' }
    }
  };
};
