export type RobotPermission = 'read' | 'write';

/**
 * Legacy "branch role" default checkout branch (deprecated; kept only for backward compatibility).
 */
export type RobotDefaultBranchRole = 'main' | 'dev' | 'test';

export interface RepoRobot {
  id: string;
  repoId: string;
  name: string;
  permission: RobotPermission;
  /**
   * Whether the robot has a dedicated token stored in DB.
   *
   * Notes:
   * - The token itself is never returned by the API for safety.
   * - If `hasToken` is false, the runtime may fall back to the creator's account-level credentials
   *   (see `backend/src/services/repoRobotAccess.ts`).
   */
  hasToken: boolean;
  /**
   * Selected account-level repo credential profile id (when the robot does not store a per-robot token).
   *
   * Stored in `repo_robots.repo_credential_profile_id`.
   */
  repoCredentialProfileId?: string;
  cloneUsername?: string;
  /**
   * Provider user id derived from the robot's effective repo token during activation test.
   * - GitLab: numeric user id (stringified)
   * - GitHub: numeric user id (stringified)
   */
  repoTokenUserId?: string;
  /**
   * Provider username/login derived from the robot's effective repo token during activation test.
   */
  repoTokenUsername?: string;
  /**
   * Provider display name derived from the robot's effective repo token during activation test.
   *
   * Used to configure git commit identity for workspace-write runs.
   */
  repoTokenUserName?: string;
  /**
   * Provider email derived from the robot's effective repo token during activation test.
   *
   * Notes:
   * - GitHub may not return email unless the token has `user:email` scope; in that case we may fall back to a noreply email.
   */
  repoTokenUserEmail?: string;
  /**
   * Derived repository role/permission for the robot's effective repo token.
   * - GitLab examples: guest/reporter/developer/maintainer/owner
   * - GitHub examples: read/triage/write/maintain/admin
   */
  repoTokenRepoRole?: string;
  /**
   * Provider-specific raw permission payload for debugging/UI display.
   */
  repoTokenRepoRoleDetails?: unknown;
  /**
   * Robot default prompt template (not rendered; supports `{{var}}` template variables).
   * - Used as the base for per-event "prompt tweaks".
   */
  promptDefault?: string;
  /**
   * Robot language (used by prompt template variable `{{robot.language}}`):
   * - Chosen in the frontend when creating/editing a robot and persisted to DB
   * - Not strictly validated; BCP 47 is recommended (e.g. zh-CN / en-US)
   */
  language?: string;
  /**
   * Model provider (e.g. `codex`, `claude_code`).
   */
  modelProvider?: string;
  /**
   * Model provider config (structure varies by provider; API responses are redacted for safety).
   */
  modelProviderConfig?: unknown;
  /**
   * Default checkout branch (branch name):
   * - Fallback branch for tasks without explicit branch info (e.g. commit comments, MR comments, issues)
   * - Also exposed to prompts as a template variable (see promptBuilder)
   */
  defaultBranch?: string;
  /**
   * Compatibility field: legacy branch roles (main/dev/test).
   */
  defaultBranchRole?: RobotDefaultBranchRole;
  /**
   * Activation time (first successful "Token test"):
   * - Used to distinguish "pending activation" vs "disabled"
   */
  activatedAt?: string;
  /**
   * Last test time.
   */
  lastTestAt?: string;
  /**
   * Whether the last test succeeded.
   */
  lastTestOk?: boolean;
  /**
   * Last test summary (failure reason / hint).
   */
  lastTestMessage?: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
