// Extract model-provider related API types for reuse across UI features. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export type ModelProvider = 'codex' | 'claude_code' | 'gemini_cli' | (string & {});
export type ProviderRoutingMode = 'fixed' | 'availability_first';
export type ProviderFailoverPolicy = 'disabled' | 'fallback_provider_once';

// Expose robot-level provider routing config in the shared model-provider type surface. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
export interface ProviderRoutingConfig {
  mode: ProviderRoutingMode;
  fallbackProvider?: ModelProvider;
  failoverPolicy: ProviderFailoverPolicy;
}

export type ModelProviderModelsSource = 'remote' | 'fallback';

export interface ModelProviderModelsResponse {
  models: string[];
  source: ModelProviderModelsSource;
}

export interface ModelProviderModelsRequest {
  provider: ModelProvider;
  profileId?: string;
  credential?: { apiBaseUrl?: string | null; apiKey?: string | null } | null;
  forceRefresh?: boolean;
}

// Accept any Codex model id to support dynamic model discovery without hardcoded unions. b8fucnmey62u0muyn7i0
export type CodexModel = string;
export type CodexSandbox = 'workspace-write' | 'read-only';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface CodexRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  /**
   * Selected credential profile id when `credentialSource` is `user` or `repo`.
   *
   * Notes:
   * - Backend validates the existence and `hasApiKey` state for the chosen profile.
   */
  credentialProfileId?: string;
  /**
   * Inline robot credential (write-only for `apiKey`, safe for display for other fields).
   *
   * Notes:
   * - Only present when `credentialSource` is `robot`.
   */
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: CodexModel;
  sandbox: CodexSandbox;
  // Codex network access is always enabled and no longer part of the config payload. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
  model_reasoning_effort: CodexReasoningEffort;
  routingConfig: ProviderRoutingConfig;
}

export type ClaudeCodeSandbox = 'workspace-write' | 'read-only';

export interface ClaudeCodeRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credentialProfileId?: string;
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: string;
  sandbox: ClaudeCodeSandbox;
  sandbox_workspace_write: { network_access: boolean };
  routingConfig: ProviderRoutingConfig;
}

export type GeminiCliSandbox = 'workspace-write' | 'read-only';

export interface GeminiCliRobotProviderConfigPublic {
  credentialSource: 'user' | 'repo' | 'robot';
  credentialProfileId?: string;
  credential?: { apiBaseUrl?: string; hasApiKey: boolean; remark?: string };
  model: string;
  sandbox: GeminiCliSandbox;
  sandbox_workspace_write: { network_access: boolean };
  routingConfig: ProviderRoutingConfig;
}


// Describe the local provider runtime-status payload returned by the account settings API. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
export type ProviderRuntimeMethod =
  | 'env_api_key'
  | 'credentials_file'
  | 'auth_json_tokens'
  | 'auth_json_api_key'
  | 'oauth_creds'
  | 'none';

export interface ProviderRuntimeStatus {
  provider: 'codex' | 'claude_code' | 'gemini_cli';
  authenticated: boolean;
  method?: ProviderRuntimeMethod;
  displayName?: string;
  supportsModelListing: boolean;
  hasApiKey: boolean;
}

export interface ProviderRuntimeStatusesResponse {
  precedence: string[];
  providers: {
    codex: ProviderRuntimeStatus;
    claude_code: ProviderRuntimeStatus;
    gemini_cli: ProviderRuntimeStatus;
  };
}
