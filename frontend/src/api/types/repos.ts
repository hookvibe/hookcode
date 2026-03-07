// Group repository and robot API types into a focused module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { UserModelProviderCredentialsPublic, UserRepoProviderCredentialsPublic } from './auth';
import type { TimeWindow } from './common';
import type { WorkerSummary } from './workers';
import type {
  ClaudeCodeRobotProviderConfigPublic,
  CodexRobotProviderConfigPublic,
  GeminiCliRobotProviderConfigPublic,
  ModelProvider
} from './models';

export type RepoProvider = 'gitlab' | 'github';
export type RepoRole = 'owner' | 'maintainer' | 'member';

export interface RepoCreatorSummary {
  userId: string;
  username: string;
  displayName?: string;
} // Show repo creator metadata on repo cards and dashboards. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5

export interface RepoPermissions {
  canRead: boolean;
  canManage: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canManageTasks: boolean;
} // Mirror backend repo permission flags for UI gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

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
  skillDefaults?: string[] | null; // Store repo-level default skills for task-group inheritance. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  creator?: RepoCreatorSummary | null;
  // Include RBAC context for repo pages. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  myRole?: RepoRole | null;
  permissions?: RepoPermissions;
}

// Return cursors for repo list pagination in the UI. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
export interface RepoListResponse {
  repos: Repository[];
  nextCursor?: string;
}

export interface RepoMember {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  email?: string;
  role: RepoRole;
  createdAt: string;
  updatedAt: string;
} // Repo member list entries for member management UI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

export interface RepoInvite {
  id: string;
  repoId: string;
  email: string;
  role: RepoRole;
  invitedByUserId: string;
  invitedUserId?: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
} // Repo invite rows for pending invite management. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

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

export interface RepoPreviewEnvVarPublic {
  key: string;
  isSecret: boolean;
  hasValue: boolean;
  value?: string;
} // Public preview env var shape with secret redaction. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302

export interface RepoPreviewEnvConfigPublic {
  variables: RepoPreviewEnvVarPublic[];
} // Repo-scoped preview env config payload for repo settings. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302

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
  // Mirror the backend worker binding fields so robot settings can target a default executor. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  defaultWorkerId?: string | null;
  activatedAt?: string;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  defaultWorker?: WorkerSummary;
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
