// Split authentication and credential API shapes into a dedicated module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { AuthUser } from '../../auth';

export interface AuthMeResponse {
  authEnabled: boolean;
  user: AuthUser | null;
  features?: { taskLogsEnabled?: boolean };
  token?: { iat: number; exp: number };
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
  roles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserModelCredentialsPublic {
  codex: UserModelProviderCredentialsPublic;
  claude_code: UserModelProviderCredentialsPublic;
  gemini_cli: UserModelProviderCredentialsPublic;
  gitlab: UserRepoProviderCredentialsPublic;
  github: UserRepoProviderCredentialsPublic;
  [key: string]: any;
}

export interface UserModelProviderCredentialProfilePublic {
  id: string;
  remark: string;
  apiBaseUrl?: string;
  hasApiKey: boolean;
}

export interface UserModelProviderCredentialsPublic {
  profiles: UserModelProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export interface UserRepoProviderCredentialProfilePublic {
  id: string;
  remark: string;
  hasToken: boolean;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentialsPublic {
  profiles: UserRepoProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

// PAT scope types for API access tokens. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
export type ApiTokenScopeGroup = 'account' | 'repos' | 'tasks' | 'events' | 'system';
export type ApiTokenScopeLevel = 'read' | 'write';

export interface ApiTokenScope {
  group: ApiTokenScopeGroup;
  level: ApiTokenScopeLevel;
}

export interface UserApiTokenPublic {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenLast4?: string | null;
  scopes: ApiTokenScope[];
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
}
