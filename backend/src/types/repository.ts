export type RepoProvider = 'gitlab' | 'github';

export interface RepositoryBranch {
  /**
   * Branch name (e.g. main/dev/release/v1).
   */
  name: string;
  /**
   * Note: describes the branch purpose (e.g. main/dev/release branch).
   */
  note?: string;
  /**
   * Whether this is the repository default branch:
   * - Fallback checkout branch for tasks without explicit branch info (lower priority than the robot default branch)
   */
  isDefault?: boolean;
}

export interface Repository {
  id: string;
  provider: RepoProvider;
  name: string;
  externalId?: string;
  apiBaseUrl?: string;
  /**
   * Set after the repository receives at least one authenticated webhook request.
   * - Used as an onboarding gate: robots/automation configuration is blocked until verified.
   */
  webhookVerifiedAt?: string;
  /**
   * Repository branch configuration (customizable):
   * - Used for trigger branch selection, robot default checkout branch, and prompt template variables
   */
  branches?: RepositoryBranch[];
  /**
   * Archived repositories are hidden from default lists and block new automation/tasks. qnp1mtxhzikhbi0xspbc
   */
  archivedAt?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
