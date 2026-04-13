import { access, readFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { CLAUDE_CODE_PROVIDER_KEY, normalizeClaudeCodeRobotProviderConfig } from './claudeCode';
import { CODEX_PROVIDER_KEY, normalizeCodexRobotProviderConfig } from './codex';
import { GEMINI_CLI_PROVIDER_KEY, normalizeGeminiCliRobotProviderConfig } from './geminiCli';
import type { RepoScopedModelProviderCredentials, RepoScopedModelProviderCredentialsByProvider } from '../modules/repositories/repository.service';
import type { UserModelCredentials, UserModelProviderCredentials } from '../modules/users/user.service';
import { pickStoredProfileById } from '../utils/credentialProfiles';

export type SupportedProviderRuntimeKey =
  | typeof CODEX_PROVIDER_KEY
  | typeof CLAUDE_CODE_PROVIDER_KEY
  | typeof GEMINI_CLI_PROVIDER_KEY;

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

export interface LocalProviderAuthStatus {
  provider: SupportedProviderRuntimeKey;
  authenticated: boolean;
  method?: ProviderResolutionMethod;
  displayName?: string;
  supportsModelListing: boolean;
  hasApiKey: boolean;
}

export interface ResolvedProviderCredentialSummary {
  provider: SupportedProviderRuntimeKey;
  requestedStoredSource: ProviderStoredSource;
  resolvedLayer: ProviderResolutionLayer;
  resolvedMethod: ProviderResolutionMethod;
  canExecute: boolean;
  displayName?: string;
  profileId?: string;
  apiBaseUrl?: string;
  supportsModelListing: boolean;
  fallbackUsed: boolean;
  reason?: string;
}

export interface ResolvedProviderCredential extends ResolvedProviderCredentialSummary {
  apiKey?: string;
  geminiLocalConfigSourceDir?: string;
}

type InternalLocalProviderCredential = LocalProviderAuthStatus & {
  apiKey?: string;
  apiBaseUrl?: string;
  geminiLocalConfigSourceDir?: string;
};

type ProviderProfile = { id?: string; apiKey?: string; apiBaseUrl?: string };

type NormalizedProviderRobotConfig = {
  credentialSource: ProviderStoredSource;
  credentialProfileId?: string;
  credential?: { apiKey?: string; apiBaseUrl?: string };
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// Centralize ClaudeCodeUI-style local auth detection and HookCode fallback resolution. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
const decodeJwtEmail = (token: string): string => {
  const raw = safeTrim(token);
  if (!raw) return '';
  const parts = raw.split('.');
  if (parts.length < 2) return '';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    return safeTrim(payload.email) || safeTrim(payload.user);
  } catch {
    return '';
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readJsonFile = async (filePath: string): Promise<Record<string, unknown> | null> => {
  try {
    const text = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const pickStoredProfile = (
  creds: UserModelProviderCredentials | RepoScopedModelProviderCredentialsByProvider | null | undefined,
  requestedProfileId?: string | null
): { profileId: string; apiKey: string; apiBaseUrl: string } | null => {
  const profiles = Array.isArray(creds?.profiles) ? creds!.profiles : [];
  // Keep explicit model-provider profile ids exact so a deleted selection cannot silently hop to another stored API key. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const selected = pickStoredProfileById({
    profiles,
    requestedProfileId,
    defaultProfileId: (creds as any)?.defaultProfileId
  });
  const profileId = safeTrim(selected?.id);
  if (!profileId) return null;
  return {
    profileId,
    apiKey: safeTrim(selected?.apiKey),
    apiBaseUrl: safeTrim(selected?.apiBaseUrl)
  };
};

const getRequestedStoredSource = (provider: SupportedProviderRuntimeKey, robotConfigRaw: unknown): NormalizedProviderRobotConfig => {
  if (provider === CODEX_PROVIDER_KEY) {
    const normalized = normalizeCodexRobotProviderConfig(robotConfigRaw);
    return {
      credentialSource: normalized.credentialSource,
      credentialProfileId: safeTrim(normalized.credentialProfileId) || undefined,
      credential: normalized.credential
    };
  }
  if (provider === CLAUDE_CODE_PROVIDER_KEY) {
    const normalized = normalizeClaudeCodeRobotProviderConfig(robotConfigRaw);
    return {
      credentialSource: normalized.credentialSource,
      credentialProfileId: safeTrim(normalized.credentialProfileId) || undefined,
      credential: normalized.credential
    };
  }
  const normalized = normalizeGeminiCliRobotProviderConfig(robotConfigRaw);
  return {
    credentialSource: normalized.credentialSource,
    credentialProfileId: safeTrim(normalized.credentialProfileId) || undefined,
    credential: normalized.credential
  };
};

const getProviderUserCredentials = (
  provider: SupportedProviderRuntimeKey,
  creds: UserModelCredentials | null | undefined
): UserModelProviderCredentials | null => {
  if (!creds) return null;
  return ((creds as any)?.[provider] as UserModelProviderCredentials | null | undefined) ?? null;
};

const getProviderRepoCredentials = (
  provider: SupportedProviderRuntimeKey,
  creds: RepoScopedModelProviderCredentials | null | undefined
): RepoScopedModelProviderCredentialsByProvider | null => {
  if (!creds) return null;
  return ((creds as any)?.[provider] as RepoScopedModelProviderCredentialsByProvider | null | undefined) ?? null;
};

const getProviderGlobalCredentials = (
  provider: SupportedProviderRuntimeKey,
  creds: UserModelCredentials | null | undefined
): UserModelProviderCredentials | null => {
  if (!creds) return null;
  return ((creds as any)?.[provider] as UserModelProviderCredentials | null | undefined) ?? null;
};

const resolveClaudeLocalCredential = async (): Promise<InternalLocalProviderCredential> => {
  const envApiKey = safeTrim(process.env.ANTHROPIC_API_KEY);
  if (envApiKey) {
    return {
      provider: CLAUDE_CODE_PROVIDER_KEY,
      authenticated: true,
      method: 'env_api_key',
      displayName: 'API Key Auth',
      supportsModelListing: true,
      hasApiKey: true,
      apiKey: envApiKey,
      apiBaseUrl: safeTrim(process.env.ANTHROPIC_BASE_URL) || safeTrim(process.env.ANTHROPIC_API_URL) || undefined
    };
  }

  const credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
  const payload = await readJsonFile(credentialsPath);
  const oauth = isRecord(payload?.claudeAiOauth) ? payload!.claudeAiOauth : null;
  const accessToken = safeTrim(oauth?.accessToken);
  const expiresAt = typeof oauth?.expiresAt === 'number' ? oauth.expiresAt : Number(oauth?.expiresAt ?? 0);
  if (accessToken && (!expiresAt || Date.now() < expiresAt)) {
    return {
      provider: CLAUDE_CODE_PROVIDER_KEY,
      authenticated: true,
      method: 'credentials_file',
      displayName: safeTrim(payload?.email) || safeTrim(payload?.user) || 'Authenticated',
      supportsModelListing: false,
      hasApiKey: false
    };
  }

  return {
    provider: CLAUDE_CODE_PROVIDER_KEY,
    authenticated: false,
    method: 'none',
    supportsModelListing: false,
    hasApiKey: false
  };
};

const resolveCodexLocalCredential = async (): Promise<InternalLocalProviderCredential> => {
  const envApiKey = safeTrim(process.env.OPENAI_API_KEY);
  if (envApiKey) {
    return {
      provider: CODEX_PROVIDER_KEY,
      authenticated: true,
      method: 'env_api_key',
      displayName: 'API Key Auth',
      supportsModelListing: true,
      hasApiKey: true,
      apiKey: envApiKey,
      apiBaseUrl: safeTrim(process.env.OPENAI_BASE_URL) || undefined
    };
  }

  const authPath = path.join(os.homedir(), '.codex', 'auth.json');
  const payload = await readJsonFile(authPath);
  const tokens = isRecord(payload?.tokens) ? payload!.tokens : null;
  const idToken = safeTrim(tokens?.id_token);
  const accessToken = safeTrim(tokens?.access_token);
  if (idToken || accessToken) {
    return {
      provider: CODEX_PROVIDER_KEY,
      authenticated: true,
      method: 'auth_json_tokens',
      displayName: decodeJwtEmail(idToken) || 'Authenticated',
      supportsModelListing: false,
      hasApiKey: false
    };
  }

  const authJsonApiKey = safeTrim(payload?.OPENAI_API_KEY);
  if (authJsonApiKey) {
    return {
      provider: CODEX_PROVIDER_KEY,
      authenticated: true,
      method: 'auth_json_api_key',
      displayName: 'API Key Auth',
      supportsModelListing: true,
      hasApiKey: true,
      apiKey: authJsonApiKey
    };
  }

  return {
    provider: CODEX_PROVIDER_KEY,
    authenticated: false,
    method: 'none',
    supportsModelListing: false,
    hasApiKey: false
  };
};

const resolveGeminiLocalCredential = async (): Promise<InternalLocalProviderCredential> => {
  const geminiApiKey = safeTrim(process.env.GEMINI_API_KEY);
  if (geminiApiKey) {
    return {
      provider: GEMINI_CLI_PROVIDER_KEY,
      authenticated: true,
      method: 'env_api_key',
      displayName: 'API Key Auth',
      supportsModelListing: true,
      hasApiKey: true,
      apiKey: geminiApiKey,
      apiBaseUrl: safeTrim(process.env.GOOGLE_GEMINI_BASE_URL) || undefined
    };
  }

  const googleApiKey = safeTrim(process.env.GOOGLE_API_KEY);
  if (googleApiKey) {
    return {
      provider: GEMINI_CLI_PROVIDER_KEY,
      authenticated: true,
      method: 'env_api_key',
      displayName: 'API Key Auth',
      supportsModelListing: true,
      hasApiKey: true,
      apiKey: googleApiKey,
      apiBaseUrl: safeTrim(process.env.GOOGLE_GEMINI_BASE_URL) || undefined
    };
  }

  const geminiDir = path.join(os.homedir(), '.gemini');
  const credsPath = path.join(geminiDir, 'oauth_creds.json');
  const creds = await readJsonFile(credsPath);
  const accessToken = safeTrim(creds?.access_token);
  if (accessToken) {
    const accounts = await readJsonFile(path.join(geminiDir, 'google_accounts.json'));
    return {
      provider: GEMINI_CLI_PROVIDER_KEY,
      authenticated: true,
      method: 'oauth_creds',
      displayName: safeTrim(accounts?.active) || 'OAuth Session',
      supportsModelListing: false,
      hasApiKey: false,
      geminiLocalConfigSourceDir: (await fileExists(geminiDir)) ? geminiDir : undefined
    };
  }

  return {
    provider: GEMINI_CLI_PROVIDER_KEY,
    authenticated: false,
    method: 'none',
    supportsModelListing: false,
    hasApiKey: false
  };
};

export const getLocalProviderAuthStatus = async (provider: SupportedProviderRuntimeKey): Promise<LocalProviderAuthStatus> => {
  const resolved =
    provider === CLAUDE_CODE_PROVIDER_KEY
      ? await resolveClaudeLocalCredential()
      : provider === CODEX_PROVIDER_KEY
        ? await resolveCodexLocalCredential()
        : await resolveGeminiLocalCredential();

  return {
    provider,
    authenticated: resolved.authenticated,
    method: resolved.method,
    displayName: resolved.displayName,
    supportsModelListing: resolved.supportsModelListing,
    hasApiKey: resolved.hasApiKey
  };
};

export const listLocalProviderAuthStatuses = async (): Promise<Record<SupportedProviderRuntimeKey, LocalProviderAuthStatus>> => {
  const entries = await Promise.all([
    getLocalProviderAuthStatus(CODEX_PROVIDER_KEY),
    getLocalProviderAuthStatus(CLAUDE_CODE_PROVIDER_KEY),
    getLocalProviderAuthStatus(GEMINI_CLI_PROVIDER_KEY)
  ]);

  return entries.reduce(
    (acc, entry) => {
      acc[entry.provider] = entry;
      return acc;
    },
    {
      [CODEX_PROVIDER_KEY]: {
        provider: CODEX_PROVIDER_KEY,
        authenticated: false,
        method: 'none',
        supportsModelListing: false,
        hasApiKey: false
      },
      [CLAUDE_CODE_PROVIDER_KEY]: {
        provider: CLAUDE_CODE_PROVIDER_KEY,
        authenticated: false,
        method: 'none',
        supportsModelListing: false,
        hasApiKey: false
      },
      [GEMINI_CLI_PROVIDER_KEY]: {
        provider: GEMINI_CLI_PROVIDER_KEY,
        authenticated: false,
        method: 'none',
        supportsModelListing: false,
        hasApiKey: false
      }
    } as Record<SupportedProviderRuntimeKey, LocalProviderAuthStatus>
  );
};

export const resolveProviderExecutionCredential = async (params: {
  provider: SupportedProviderRuntimeKey;
  robotConfigRaw?: unknown;
  userCredentials?: UserModelCredentials | null;
  repoScopedCredentials?: RepoScopedModelProviderCredentials | null;
  globalCredentials?: UserModelCredentials | null;
  defaultStoredSource?: ProviderStoredSource;
}): Promise<ResolvedProviderCredential> => {
  const local =
    params.provider === CLAUDE_CODE_PROVIDER_KEY
      ? await resolveClaudeLocalCredential()
      : params.provider === CODEX_PROVIDER_KEY
        ? await resolveCodexLocalCredential()
        : await resolveGeminiLocalCredential();

  const normalizedRobotConfig = getRequestedStoredSource(params.provider, params.robotConfigRaw);
  // Allow callers without robot config to choose whether stored fallback should start from repo or user. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
  const requestedStoredSource = params.defaultStoredSource ?? normalizedRobotConfig.credentialSource;
  if (local.authenticated) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'local',
      resolvedMethod: local.method ?? 'none',
      canExecute: true,
      displayName: local.displayName,
      apiKey: local.apiKey,
      apiBaseUrl: local.apiBaseUrl,
      supportsModelListing: local.supportsModelListing,
      fallbackUsed: false,
      geminiLocalConfigSourceDir: local.geminiLocalConfigSourceDir
    };
  }

  const robotApiKey = safeTrim(normalizedRobotConfig.credential?.apiKey);
  const robotApiBaseUrl = safeTrim(normalizedRobotConfig.credential?.apiBaseUrl);
  if (robotApiKey) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'robot',
      resolvedMethod: 'robot_embedded',
      canExecute: true,
      apiKey: robotApiKey,
      apiBaseUrl: robotApiBaseUrl || undefined,
      supportsModelListing: true,
      fallbackUsed: requestedStoredSource !== 'robot'
    };
  }

  const repoCredentials = getProviderRepoCredentials(params.provider, params.repoScopedCredentials);
  const userCredentials = getProviderUserCredentials(params.provider, params.userCredentials);
  const globalCredentials = getProviderGlobalCredentials(params.provider, params.globalCredentials);
  const globalProfile = pickStoredProfile(
    globalCredentials,
    requestedStoredSource === 'global' ? normalizedRobotConfig.credentialProfileId : undefined
  );

  const repoProfile = pickStoredProfile(
    repoCredentials,
    requestedStoredSource === 'repo' ? normalizedRobotConfig.credentialProfileId : undefined
  );
  const userProfile = pickStoredProfile(
    userCredentials,
    requestedStoredSource === 'user' ? normalizedRobotConfig.credentialProfileId : undefined
  );

  if (requestedStoredSource === 'global' && globalProfile?.apiKey) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'global',
      resolvedMethod: 'global_profile',
      canExecute: true,
      profileId: globalProfile.profileId,
      apiKey: globalProfile.apiKey,
      apiBaseUrl: globalProfile.apiBaseUrl || undefined,
      supportsModelListing: true,
      fallbackUsed: false
    };
  }

  if (requestedStoredSource === 'global' && userProfile?.apiKey) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'user',
      resolvedMethod: 'user_profile',
      canExecute: true,
      profileId: userProfile.profileId,
      apiKey: userProfile.apiKey,
      apiBaseUrl: userProfile.apiBaseUrl || undefined,
      supportsModelListing: true,
      fallbackUsed: true,
      reason: 'Requested global profile was unavailable, so the resolver fell back to the user-scoped profile.'
    };
  }

  if (requestedStoredSource === 'repo' && repoProfile?.apiKey) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'repo',
      resolvedMethod: 'repo_profile',
      canExecute: true,
      profileId: repoProfile.profileId,
      apiKey: repoProfile.apiKey,
      apiBaseUrl: repoProfile.apiBaseUrl || undefined,
      supportsModelListing: true,
      fallbackUsed: false
    };
  }

  if (requestedStoredSource === 'repo' && userProfile?.apiKey) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'user',
      resolvedMethod: 'user_profile',
      canExecute: true,
      profileId: userProfile.profileId,
      apiKey: userProfile.apiKey,
      apiBaseUrl: userProfile.apiBaseUrl || undefined,
      supportsModelListing: true,
      fallbackUsed: true,
      reason: 'Requested repo-scoped profile was unavailable, so the resolver fell back to the user-scoped profile.'
    };
  }

  if (globalProfile?.apiKey) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'global',
      resolvedMethod: 'global_profile',
      canExecute: true,
      profileId: globalProfile.profileId,
      apiKey: globalProfile.apiKey,
      apiBaseUrl: globalProfile.apiBaseUrl || undefined,
      supportsModelListing: true,
      fallbackUsed: requestedStoredSource !== 'global'
    };
  }

  if (userProfile?.apiKey) {
    return {
      provider: params.provider,
      requestedStoredSource,
      resolvedLayer: 'user',
      resolvedMethod: 'user_profile',
      canExecute: true,
      profileId: userProfile.profileId,
      apiKey: userProfile.apiKey,
      apiBaseUrl: userProfile.apiBaseUrl || undefined,
      supportsModelListing: true,
      fallbackUsed: requestedStoredSource !== 'user'
    };
  }

  return {
    provider: params.provider,
    requestedStoredSource,
    resolvedLayer: 'none',
    resolvedMethod: 'none',
    canExecute: false,
    supportsModelListing: false,
    fallbackUsed: false,
    reason: 'No local auth, embedded robot credential, global-scoped profile, repo-scoped profile, or user-scoped profile was available for this provider.'
  };
};

export const toPublicResolvedProviderCredential = (
  resolved: ResolvedProviderCredential
): ResolvedProviderCredentialSummary => ({
  provider: resolved.provider,
  requestedStoredSource: resolved.requestedStoredSource,
  resolvedLayer: resolved.resolvedLayer,
  resolvedMethod: resolved.resolvedMethod,
  canExecute: resolved.canExecute,
  displayName: resolved.displayName,
  profileId: resolved.profileId,
  apiBaseUrl: resolved.apiBaseUrl,
  supportsModelListing: resolved.supportsModelListing,
  fallbackUsed: resolved.fallbackUsed,
  reason: resolved.reason
});
