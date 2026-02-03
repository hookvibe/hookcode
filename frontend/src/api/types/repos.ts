// Group repository and robot API types into a focused module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { UserModelProviderCredentialsPublic, UserRepoProviderCredentialsPublic } from './auth';
import type { TimeWindow } from './common';
import type {
  ClaudeCodeRobotProviderConfigPublic,
  CodexRobotProviderConfigPublic,
  GeminiCliRobotProviderConfigPublic,
  ModelProvider
} from './models';

export type RepoProvider = 'gitlab' | 'github';

export interface RepositoryBranch {
  name: string;
  note?: string;
  isDefault?: boolean;
}

export interface Repository {
  id: string;
  provider: RepoProvider;
  name: string;
  externalId?: string;
  apiBaseUrl?: string;
  webhookVerifiedAt?: string;
  // Archived repositories are hidden from default lists and block new automation/tasks. qnp1mtxhzikhbi0xspbc
  archivedAt?: string;
  branches?: RepositoryBranch[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RobotPermission = 'read' | 'write';

export interface RepoScopedCredentialsPublic {
  // Business intent: repo-scoped credentials use the same "profile" shape as account credentials,
  // so the UI can reuse the same components for listing/editing defaults.
  repoProvider: UserRepoProviderCredentialsPublic;
  modelProvider: {
    codex: UserModelProviderCredentialsPublic;
    claude_code: UserModelProviderCredentialsPublic;
    gemini_cli: UserModelProviderCredentialsPublic;
  };
}

export interface RepoRobot {
  id: string;
  repoId: string;
  name: string;
  permission: RobotPermission;
  hasToken: boolean;
  repoCredentialSource?: 'robot' | 'user' | 'repo';
  repoCredentialProfileId?: string;
  repoCredentialRemark?: string;
  cloneUsername?: string;
  repoTokenUserId?: string;
  repoTokenUsername?: string;
  repoTokenUserName?: string;
  repoTokenUserEmail?: string;
  repoTokenRepoRole?: string;
  repoTokenRepoRoleDetails?: unknown;
  promptDefault?: string;
  language?: string;
  modelProvider?: ModelProvider;
  modelProviderConfig?: CodexRobotProviderConfigPublic | ClaudeCodeRobotProviderConfigPublic | GeminiCliRobotProviderConfigPublic;
  // Dependency overrides for multi-language installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyConfig?: { enabled?: boolean; failureMode?: 'soft' | 'hard'; allowCustomInstall?: boolean };
  defaultBranch?: string;
  // Compatibility: legacy field.
  defaultBranchRole?: 'main' | 'dev' | 'test';
  // Repo workflow mode selection (auto/direct/fork). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  repoWorkflowMode?: 'auto' | 'direct' | 'fork';
  // Optional hour-level execution window for this robot. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow;
  activatedAt?: string;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RepoProviderVisibility = 'public' | 'private' | 'internal' | 'unknown';

export interface RepoProviderActivityItem {
  id: string;
  shortId?: string;
  title: string;
  url?: string;
  state?: string;
  time?: string;
  taskGroups?: Array<{
    id: string;
    kind: string;
    title?: string;
    updatedAt: string;
    processingTasks?: Array<{ id: string; status: string; title?: string; updatedAt?: string }>;
  }>;
}

export interface RepoProviderActivityPage {
  items: RepoProviderActivityItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface RepoProviderActivity {
  provider: RepoProvider;
  commits: RepoProviderActivityPage;
  merges: RepoProviderActivityPage;
  issues: RepoProviderActivityPage;
}

export type RepoCredentialProfileStatus = 'ready' | 'missing_repo_token' | 'missing_clone_username';

export interface RepoCredentialProfile {
  id: string;
  repoId: string;
  name: string;
  status: RepoCredentialProfileStatus;
  cloneUsername?: string;
  hasToken: boolean;
  createdAt: string;
  updatedAt: string;
}
