import type { RobotDependencyConfig } from './dependency';
import type { RobotDefaultBranchRole, RobotPermission } from './repoRobot';
import type { TimeWindow } from './timeWindow';
import type { WorkerSummary } from './worker';

export interface GlobalRobot {
  // Mark shared robots explicitly so mixed-scope APIs and UI can surface global origin. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  scope: 'global';
  id: string;
  name: string;
  permission: RobotPermission;
  /**
   * Repo provider credential source for this globally shared robot:
   * - global: use the admin-managed credential profile selected by `repoCredentialProfileId`
   * - user: use the account-level credential profile selected by `repoCredentialProfileId`
   * - repo: use the repo-scoped credential profile selected by `repoCredentialProfileId`
   *
   * Notes:
   * - Global robots intentionally do not embed repo-provider tokens because they can run across multiple repositories/providers.
   */
  repoCredentialSource?: 'global' | 'user' | 'repo';
  /**
   * Selected credential profile id for the chosen stored source.
   *
   * Notes:
   * - When omitted, runtime resolution falls back to the source's default profile.
   */
  repoCredentialProfileId?: string;
  // Persist an optional default worker for shared robots so cross-repo tasks can route to a chosen executor. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  defaultWorkerId?: string;
  /**
   * Robot default prompt template (not rendered; supports `{{var}}` template variables).
   */
  promptDefault?: string;
  /**
   * Robot language (used by prompt template variable `{{robot.language}}`).
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
   * Dependency management overrides for this global robot. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
   */
  dependencyConfig?: RobotDependencyConfig;
  /**
   * Default checkout branch for tasks without explicit branch info.
   */
  defaultBranch?: string;
  /**
   * Compatibility field: legacy branch roles (main/dev/test).
   */
  defaultBranchRole?: RobotDefaultBranchRole;
  /**
   * Repository workflow mode (auto/direct/fork) used to control upstream vs fork behavior. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
   */
  repoWorkflowMode?: 'auto' | 'direct' | 'fork';
  /**
   * Optional hour-level execution window for this global robot (server-local time). docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
   */
  timeWindow?: TimeWindow;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  // Return compact worker metadata with global robot payloads so settings and task views can show the executor target. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  defaultWorker?: WorkerSummary;
}

export interface GlobalRobotWithTokenLike extends GlobalRobot {
  // Preserve an optional raw provider config for merge/update flows without leaking secrets in API output. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  modelProviderConfigRaw?: unknown;
}
