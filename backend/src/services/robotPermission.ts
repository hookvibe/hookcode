import { CODEX_PROVIDER_KEY, normalizeCodexRobotProviderConfig } from '../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY, normalizeClaudeCodeRobotProviderConfig } from '../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY, normalizeGeminiCliRobotProviderConfig } from '../modelProviders/geminiCli';
import type { RobotPermission } from '../types/repoRobot';

export const inferRobotPermission = (params: {
  modelProvider?: string;
  modelProviderConfig?: unknown;
}): RobotPermission => {
  const provider = typeof params.modelProvider === 'string' ? params.modelProvider.trim().toLowerCase() : '';
  if (!provider || provider === CODEX_PROVIDER_KEY) {
    const cfg = normalizeCodexRobotProviderConfig(params.modelProviderConfig);
    return cfg.sandbox === 'workspace-write' ? 'write' : 'read';
  }
  if (provider === CLAUDE_CODE_PROVIDER_KEY) {
    // Change record: Claude Code uses the same sandbox intent mapping as Codex for permission inference.
    const cfg = normalizeClaudeCodeRobotProviderConfig(params.modelProviderConfig);
    return cfg.sandbox === 'workspace-write' ? 'write' : 'read';
  }
  if (provider === GEMINI_CLI_PROVIDER_KEY) {
    // Change record: Gemini CLI uses the same sandbox intent mapping as Codex for permission inference.
    const cfg = normalizeGeminiCliRobotProviderConfig(params.modelProviderConfig);
    return cfg.sandbox === 'workspace-write' ? 'write' : 'read';
  }
  return 'read';
};
