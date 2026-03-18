import {
  CODEX_PROVIDER_KEY,
  normalizeCodexRobotProviderConfig,
  type CodexRobotProviderConfig
} from '../modelProviders/codex';
import {
  CLAUDE_CODE_PROVIDER_KEY,
  normalizeClaudeCodeRobotProviderConfig,
  type ClaudeCodeRobotProviderConfig
} from '../modelProviders/claudeCode';
import {
  GEMINI_CLI_PROVIDER_KEY,
  normalizeGeminiCliRobotProviderConfig,
  type GeminiCliRobotProviderConfig
} from '../modelProviders/geminiCli';
import type { RoutedProviderKey } from '../providerRouting/providerRouting.types';

export type ProviderRunConfig =
  | {
      provider: typeof CODEX_PROVIDER_KEY;
      normalized: CodexRobotProviderConfig;
      sandbox: 'read-only' | 'workspace-write';
      networkAccess: boolean;
      outputLastMessageFileName: string;
    }
  | {
      provider: typeof CLAUDE_CODE_PROVIDER_KEY;
      normalized: ClaudeCodeRobotProviderConfig;
      sandbox: 'read-only' | 'workspace-write';
      networkAccess: boolean;
      outputLastMessageFileName: string;
    }
  | {
      provider: typeof GEMINI_CLI_PROVIDER_KEY;
      normalized: GeminiCliRobotProviderConfig;
      sandbox: 'read-only' | 'workspace-write';
      networkAccess: boolean;
      outputLastMessageFileName: string;
    };

// Share provider execution normalization between live task runs and robot dry-run previews. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313
export const resolveProviderRunConfig = (provider: RoutedProviderKey, rawConfig: unknown): ProviderRunConfig => {
  if (provider === CODEX_PROVIDER_KEY) {
    const normalized = normalizeCodexRobotProviderConfig(rawConfig);
    return {
      provider,
      normalized,
      sandbox: normalized.sandbox,
      networkAccess: true,
      outputLastMessageFileName: 'codex-output.txt'
    };
  }

  if (provider === CLAUDE_CODE_PROVIDER_KEY) {
    const normalized = normalizeClaudeCodeRobotProviderConfig(rawConfig);
    return {
      provider,
      normalized,
      sandbox: normalized.sandbox,
      networkAccess: normalized.sandbox === 'workspace-write' && normalized.sandbox_workspace_write.network_access,
      outputLastMessageFileName: 'claude-output.txt'
    };
  }

  const normalized = normalizeGeminiCliRobotProviderConfig(rawConfig);
  return {
    provider,
    normalized,
    sandbox: normalized.sandbox,
    networkAccess: normalized.sandbox === 'workspace-write' && normalized.sandbox_workspace_write.network_access,
    outputLastMessageFileName: 'gemini-output.txt'
  };
};
