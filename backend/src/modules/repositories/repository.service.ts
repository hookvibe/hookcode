import { randomUUID, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { Prisma } from '@prisma/client';
import type { RepoProvider, Repository, RepositoryBranch } from '../../types/repository';
import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY } from '../../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY } from '../../modelProviders/geminiCli';
import { normalizeHttpBaseUrl } from '../../utils/url';
import { envValueHasFixedPort } from '../../utils/previewEnv';
import type { UpdatedAtCursor } from '../../utils/pagination';

const clampRepoListLimit = (value: number | undefined, fallback: number): number => {
  // Keep repository pagination page sizes bounded for consistent list performance. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  if (num <= 0) return fallback;
  return Math.min(num, 50);
};

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const normalizeProvider = (input: string): RepoProvider => {
  const raw = input.trim().toLowerCase();
  if (raw === 'gitlab' || raw === 'github') return raw;
  throw new Error('provider must be gitlab or github');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeBranches = (value: unknown): RepositoryBranch[] => {
  if (!Array.isArray(value)) return [];
  const list: RepositoryBranch[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;
    const note = typeof raw.note === 'string' ? raw.note.trim() : '';
    const isDefault = Boolean(raw.isDefault);
    list.push({ name, note: note || undefined, isDefault });
  }

  const seen = new Set<string>();
  const deduped = list.filter((b) => {
    if (!b.name) return false;
    if (seen.has(b.name)) return false;
    seen.add(b.name);
    return true;
  });

  let defaultSeen = false;
  return deduped.map((b) => {
    if (!b.isDefault) return b;
    if (defaultSeen) return { ...b, isDefault: false };
    defaultSeen = true;
    return b;
  });
};

export interface RepoScopedRepoProviderCredentialProfile {
  id: string;
  remark: string;
  token?: string;
  cloneUsername?: string;
}

export interface RepoScopedRepoProviderCredentials {
  profiles: RepoScopedRepoProviderCredentialProfile[];
  defaultProfileId?: string;
}

export interface RepoScopedRepoProviderCredentialProfilePublic {
  id: string;
  remark: string;
  hasToken: boolean;
  cloneUsername?: string;
}

export interface RepoScopedRepoProviderCredentialsPublic {
  profiles: RepoScopedRepoProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export interface RepoScopedModelProviderCredentialProfile {
  id: string;
  remark: string;
  apiBaseUrl?: string;
  apiKey?: string;
}

export interface RepoScopedModelProviderCredentialsByProvider {
  profiles: RepoScopedModelProviderCredentialProfile[];
  defaultProfileId?: string;
}

export interface RepoScopedModelProviderCredentials {
  codex: RepoScopedModelProviderCredentialsByProvider;
  claude_code: RepoScopedModelProviderCredentialsByProvider;
  gemini_cli: RepoScopedModelProviderCredentialsByProvider;
  [key: string]: any;
}

export interface RepoScopedModelProviderCredentialProfilePublic {
  id: string;
  remark: string;
  apiBaseUrl?: string;
  hasApiKey: boolean;
}

export interface RepoScopedModelProviderCredentialsPublicByProvider {
  profiles: RepoScopedModelProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export interface RepoScopedModelProviderCredentialsPublic {
  codex: RepoScopedModelProviderCredentialsPublicByProvider;
  claude_code: RepoScopedModelProviderCredentialsPublicByProvider;
  gemini_cli: RepoScopedModelProviderCredentialsPublicByProvider;
  [key: string]: any;
}

export interface RepoScopedCredentialsPublic {
  repoProvider: RepoScopedRepoProviderCredentialsPublic;
  modelProvider: RepoScopedModelProviderCredentialsPublic;
}

export interface RepoPreviewEnvVar {
  key: string;
  value?: string;
  secret?: boolean;
}

export interface RepoPreviewEnvConfig {
  variables: RepoPreviewEnvVar[];
}

export interface RepoPreviewEnvVarPublic {
  key: string;
  isSecret: boolean;
  hasValue: boolean;
  value?: string;
}

export interface RepoPreviewEnvConfigPublic {
  variables: RepoPreviewEnvVarPublic[];
}

export type ArchiveScope = 'active' | 'archived' | 'all'; // Centralize archive filtering across services. qnp1mtxhzikhbi0xspbc

const normalizeRepoScopedRepoProviderCredentials = (raw: unknown): RepoScopedRepoProviderCredentials => {
  if (!isRecord(raw)) return { profiles: [], defaultProfileId: undefined };
  const profilesRaw = Array.isArray(raw.profiles) ? raw.profiles : [];
  const profiles: RepoScopedRepoProviderCredentialProfile[] = profilesRaw
    .map((item) => (isRecord(item) ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((item) => {
      const id = asTrimmedString(item!.id);
      const remark = asTrimmedString(item!.remark);
      const token = asTrimmedString(item!.token);
      const cloneUsername = asTrimmedString(item!.cloneUsername);
      return {
        id,
        remark,
        token: token ? token : undefined,
        cloneUsername: cloneUsername ? cloneUsername : undefined
      };
    })
    .filter((p) => p.id && p.remark);

  const defaultProfileId = asTrimmedString(raw.defaultProfileId);
  const defaultValid = defaultProfileId && profiles.some((p) => p.id === defaultProfileId);
  return { profiles, defaultProfileId: defaultValid ? defaultProfileId : undefined };
};

const toPublicRepoScopedRepoProviderCredentials = (raw: unknown): RepoScopedRepoProviderCredentialsPublic => {
  const normalized = normalizeRepoScopedRepoProviderCredentials(raw);
  const profiles: RepoScopedRepoProviderCredentialProfilePublic[] = (normalized.profiles ?? []).map((p) => {
    const token = (p.token ?? '').trim();
    const cloneUsername = (p.cloneUsername ?? '').trim();
    const remark = (p.remark ?? '').trim();
    return {
      id: p.id,
      remark,
      hasToken: Boolean(token),
      cloneUsername: cloneUsername ? cloneUsername : undefined
    };
  });
  const defaultProfileId = (normalized.defaultProfileId ?? '').trim();
  const defaultValid = defaultProfileId && profiles.some((p) => p.id === defaultProfileId);
  return { profiles, defaultProfileId: defaultValid ? defaultProfileId : undefined };
};

const normalizeRepoScopedModelProviderCredentialsByProvider = (raw: unknown): RepoScopedModelProviderCredentialsByProvider => {
  if (!isRecord(raw)) return { profiles: [], defaultProfileId: undefined };
  const profilesRaw = Array.isArray(raw.profiles) ? raw.profiles : [];
  const profiles: RepoScopedModelProviderCredentialProfile[] = profilesRaw
    .map((item) => (isRecord(item) ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((item) => {
      const id = asTrimmedString(item!.id);
      const remark = asTrimmedString(item!.remark);
      const apiKey = asTrimmedString(item!.apiKey);
      const apiBaseUrl = normalizeHttpBaseUrl(item!.apiBaseUrl);
      return {
        id,
        remark,
        apiKey: apiKey ? apiKey : undefined,
        apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined
      };
    })
    .filter((p) => p.id && p.remark);

  const defaultProfileId = asTrimmedString(raw.defaultProfileId);
  const defaultValid = defaultProfileId && profiles.some((p) => p.id === defaultProfileId);
  return { profiles, defaultProfileId: defaultValid ? defaultProfileId : undefined };
};

const normalizeRepoScopedModelProviderCredentials = (raw: unknown): RepoScopedModelProviderCredentials => {
  if (!isRecord(raw)) {
    return {
      codex: { profiles: [], defaultProfileId: undefined },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined }
    };
  }

  return {
    codex: normalizeRepoScopedModelProviderCredentialsByProvider(raw[CODEX_PROVIDER_KEY]),
    claude_code: normalizeRepoScopedModelProviderCredentialsByProvider(raw[CLAUDE_CODE_PROVIDER_KEY]),
    gemini_cli: normalizeRepoScopedModelProviderCredentialsByProvider(raw[GEMINI_CLI_PROVIDER_KEY])
  };
};

// Reserve system env keys from repo injection to protect preview ports and runtime defaults. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
const RESERVED_REPO_ENV_KEYS = new Set([
  'PORT',
  'HOST',
  'BROWSER',
  'NODE_ENV',
  'PATH',
  'PWD',
  'HOME',
  'SHELL',
  'TMP',
  'TEMP',
  'TMPDIR'
]);
const RESERVED_REPO_ENV_PREFIXES = ['HOOKCODE_'];

// Normalize and validate repo env keys before persistence. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
const normalizeRepoEnvKey = (raw: unknown): string => {
  const key = asTrimmedString(raw).toUpperCase();
  if (!key) throw new Error('repo env key is required');
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new Error(`repo env key "${key}" must be uppercase A-Z, 0-9, underscore`);
  }
  if (RESERVED_REPO_ENV_KEYS.has(key) || RESERVED_REPO_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    throw new Error(`repo env key "${key}" is reserved`);
  }
  return key;
};

// Normalize stored repo preview env config while enforcing reserved keys. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
const normalizeRepoPreviewEnvConfig = (raw: unknown): RepoPreviewEnvConfig => {
  if (!isRecord(raw)) return { variables: [] };
  const varsRaw = Array.isArray(raw.variables) ? raw.variables : [];
  const variables: RepoPreviewEnvVar[] = varsRaw
    .map((item) => (isRecord(item) ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((item) => {
      const key = normalizeRepoEnvKey(item!.key);
      const value = asTrimmedString(item!.value);
      const secret = Boolean(item!.secret);
      return {
        key,
        value: value ? value : undefined,
        secret: secret ? true : undefined
      };
    })
    .filter((entry) => entry.key && entry.value);
  return { variables };
};

// Redact secret repo env values for API responses. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
const toPublicRepoPreviewEnvConfig = (raw: unknown): RepoPreviewEnvConfigPublic => {
  const normalized = normalizeRepoPreviewEnvConfig(raw);
  const variables: RepoPreviewEnvVarPublic[] = normalized.variables.map((entry) => {
    const value = String(entry.value ?? '').trim();
    return {
      key: entry.key,
      // Always hide preview env values in API responses. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
      isSecret: true,
      hasValue: Boolean(value)
    };
  });
  return { variables };
};

// Flatten repo preview env config into a process env map for preview runs. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
const toRepoPreviewEnvMap = (config: RepoPreviewEnvConfig): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const entry of config.variables) {
    const value = String(entry.value ?? '').trim();
    if (!value) continue;
    map[entry.key] = value;
  }
  return map;
};

const toPublicRepoScopedModelProviderCredentials = (raw: unknown): RepoScopedModelProviderCredentialsPublic => {
  const normalized = normalizeRepoScopedModelProviderCredentials(raw);

  const toPublicProvider = (
    creds: RepoScopedModelProviderCredentialsByProvider | undefined
  ): RepoScopedModelProviderCredentialsPublicByProvider => {
    const profiles: RepoScopedModelProviderCredentialProfilePublic[] = (creds?.profiles ?? []).map((p) => {
      const apiKey = (p.apiKey ?? '').trim();
      const apiBaseUrl = (p.apiBaseUrl ?? '').trim();
      const remark = (p.remark ?? '').trim();
      return {
        id: p.id,
        remark,
        apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
        hasApiKey: Boolean(apiKey)
      };
    });
    const defaultProfileId = (creds?.defaultProfileId ?? '').trim();
    const defaultValid = defaultProfileId && profiles.some((p) => p.id === defaultProfileId);
    return { profiles, defaultProfileId: defaultValid ? defaultProfileId : undefined };
  };

  return {
    codex: toPublicProvider(normalized.codex),
    claude_code: toPublicProvider(normalized.claude_code),
    gemini_cli: toPublicProvider(normalized.gemini_cli)
  };
};

const toPublicRepoScopedCredentials = (raw: {
  repoProvider: unknown;
  modelProvider: unknown;
}): RepoScopedCredentialsPublic => ({
  repoProvider: toPublicRepoScopedRepoProviderCredentials(raw.repoProvider),
  modelProvider: toPublicRepoScopedModelProviderCredentials(raw.modelProvider)
});

const recordToRepository = (row: any): Repository => ({
  id: String(row.id),
  provider: normalizeProvider(String(row.provider)),
  name: String(row.name),
  externalId: row.externalId ?? undefined,
  apiBaseUrl: row.apiBaseUrl ?? undefined,
  webhookVerifiedAt: row.webhookVerifiedAt ? toIso(row.webhookVerifiedAt) : undefined,
  branches: normalizeBranches(row.branches),
  // Archived repositories are hidden from default lists and block new automation/tasks. qnp1mtxhzikhbi0xspbc
  archivedAt: row.archivedAt ? toIso(row.archivedAt) : undefined,
  skillDefaults: Array.isArray(row.skillDefaults ?? row.skill_defaults) ? (row.skillDefaults ?? row.skill_defaults) : null,
  // Surface repo-level default skills for task-group defaults. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  enabled: Boolean(row.enabled),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

export interface CreateRepositoryInput {
  provider: RepoProvider;
  name: string;
  externalId?: string | null;
  apiBaseUrl?: string | null;
  branches?: RepositoryBranch[] | null;
  webhookSecret?: string | null;
  enabled?: boolean;
}

export interface UpdateRepositoryInput {
  name?: string;
  externalId?: string | null;
  apiBaseUrl?: string | null;
  branches?: RepositoryBranch[] | null;
  webhookSecret?: string | null;
  repoProviderCredential?: {
    profiles?: Array<{
      id?: string;
      remark?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
  modelProviderCredential?: {
    codex?: {
      profiles?: Array<{
        id?: string;
        remark?: string | null;
        apiBaseUrl?: string | null;
        apiKey?: string | null;
      }> | null;
      removeProfileIds?: string[] | null;
      defaultProfileId?: string | null;
    } | null;
    claude_code?: {
      profiles?: Array<{
        id?: string;
        remark?: string | null;
        apiBaseUrl?: string | null;
        apiKey?: string | null;
      }> | null;
      removeProfileIds?: string[] | null;
      defaultProfileId?: string | null;
    } | null;
    gemini_cli?: {
      profiles?: Array<{
        id?: string;
        remark?: string | null;
        apiBaseUrl?: string | null;
        apiKey?: string | null;
      }> | null;
      removeProfileIds?: string[] | null;
      defaultProfileId?: string | null;
    } | null;
  } | null;
  // Accept repo-scoped preview env patches (write-only secrets). docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
  previewEnvConfig?: {
    entries?: Array<{
      key?: string | null;
      value?: string | null;
      secret?: boolean | null;
    }> | null;
    removeKeys?: string[] | null;
  } | null;
  enabled?: boolean;
}

const generateWebhookSecret = (): string => randomBytes(24).toString('hex');

@Injectable()
export class RepositoryService {
  async markWebhookVerified(id: string, at: Date = new Date()): Promise<boolean> {
    const result = await db.repository.updateMany({
      where: { id, webhookVerifiedAt: null },
      data: { webhookVerifiedAt: at, updatedAt: at }
    });
    return result.count > 0;
  }

  async getById(id: string): Promise<Repository | null> {
    const row = await db.repository.findUnique({ where: { id } });
    return row ? recordToRepository(row) : null;
  }

  async getByIdWithSecret(id: string): Promise<{ repo: Repository; webhookSecret: string | null } | null> {
    const row = await db.repository.findUnique({ where: { id } });
    if (!row) return null;
    return { repo: recordToRepository(row), webhookSecret: row.webhookSecret ?? null };
  }

  async getRepoScopedCredentials(id: string): Promise<{
    repoProvider: RepoScopedRepoProviderCredentials;
    modelProvider: RepoScopedModelProviderCredentials;
    public: RepoScopedCredentialsPublic;
  } | null> {
    const row = await db.repository.findUnique({
      where: { id },
      select: { repoProviderCredentials: true, modelProviderCredentials: true }
    });
    if (!row) return null;
    const repoProvider = normalizeRepoScopedRepoProviderCredentials(row.repoProviderCredentials);
    const modelProvider = normalizeRepoScopedModelProviderCredentials(row.modelProviderCredentials);
    return {
      repoProvider,
      modelProvider,
      public: toPublicRepoScopedCredentials({
        repoProvider: row.repoProviderCredentials,
        modelProvider: row.modelProviderCredentials
      })
    };
  }

  // Read repo preview env config with secret redaction for API responses. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
  async getRepoPreviewEnvConfig(id: string): Promise<{
    raw: RepoPreviewEnvConfig;
    public: RepoPreviewEnvConfigPublic;
  } | null> {
    const row = await db.repository.findUnique({
      where: { id },
      select: { previewEnv: true }
    });
    if (!row) return null;
    return {
      raw: normalizeRepoPreviewEnvConfig(row.previewEnv),
      public: toPublicRepoPreviewEnvConfig(row.previewEnv)
    };
  }

  // Provide repo preview env variables for preview process launches. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
  async getRepoPreviewEnv(id: string): Promise<Record<string, string> | null> {
    const config = await this.getRepoPreviewEnvConfig(id);
    if (!config) return null;
    return toRepoPreviewEnvMap(config.raw);
  }

  async listAll(options?: { userId?: string; isAdmin?: boolean; limit?: number; cursor?: UpdatedAtCursor | null }): Promise<Repository[]> {
    // Default to listing active (non-archived) repos for backward compatible UI behavior. qnp1mtxhzikhbi0xspbc
    return this.listByArchiveScope('active', options);
  }

  async listByArchiveScope(
    scope: ArchiveScope,
    options?: { userId?: string; isAdmin?: boolean; limit?: number; cursor?: UpdatedAtCursor | null }
  ): Promise<Repository[]> {
    // Archive listing is used by both the normal Repos page and the dedicated Archive area. qnp1mtxhzikhbi0xspbc
    const archivedScope: ArchiveScope = scope ?? 'active';
    const take = clampRepoListLimit(options?.limit, 50);
    const cursor = options?.cursor ?? null;
    const cursorUpdatedAt = cursor?.updatedAt ?? null;
    const cursorId = cursor?.id ?? null;
    const applyCursor = Boolean(cursorUpdatedAt && cursorId);
    const where: Prisma.RepositoryWhereInput = {};
    if (archivedScope === 'active') where.archivedAt = null;
    if (archivedScope === 'archived') where.archivedAt = { not: null };
    if (options?.userId && !options.isAdmin) {
      // Apply membership filter for private repo access. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      where.members = { some: { userId: options.userId } };
    }
    if (applyCursor) {
      // Apply keyset pagination for repo lists using updatedAt + id ordering. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
      where.OR = [
        { updatedAt: { lt: cursorUpdatedAt! } },
        { updatedAt: cursorUpdatedAt!, id: { lt: cursorId! } }
      ];
    }

    const rows = await db.repository.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take
    });
    return rows.map(recordToRepository);
  }

  async archiveRepo(
    id: string,
    _actor: { id: string } | null
  ): Promise<{ repo: Repository; tasksArchived: number; taskGroupsArchived: number } | null> {
    // Archive semantics:
    // - Scope: repository + all tasks/task_groups under it.
    // - Safety: archived repos are still readable, but they block webhook/manual task creation. qnp1mtxhzikhbi0xspbc
    const repoId = String(id ?? '').trim();
    const now = new Date();

    return db.$transaction(async (tx) => {
      const existing = await tx.repository.findUnique({ where: { id: repoId } });
      if (!existing) return null;

      if (!existing.archivedAt) {
        await tx.repository.update({
          where: { id: repoId },
          data: { archivedAt: now, updatedAt: now }
        });
      }

      const tasksResult = await tx.task.updateMany({
        where: { repoId, archivedAt: null },
        data: { archivedAt: now }
      });
      const groupsResult = await tx.taskGroup.updateMany({
        where: { repoId, archivedAt: null },
        data: { archivedAt: now }
      });

      const row = await tx.repository.findUnique({ where: { id: repoId } });
      if (!row) return null;
      return {
        repo: recordToRepository(row),
        tasksArchived: tasksResult.count ?? 0,
        taskGroupsArchived: groupsResult.count ?? 0
      };
    });
  }

  async unarchiveRepo(
    id: string,
    _actor: { id: string } | null
  ): Promise<{ repo: Repository; tasksRestored: number; taskGroupsRestored: number } | null> {
    // Unarchive restores the repository and its related tasks/task_groups back into the default console views. qnp1mtxhzikhbi0xspbc
    const repoId = String(id ?? '').trim();
    const now = new Date();

    return db.$transaction(async (tx) => {
      const existing = await tx.repository.findUnique({ where: { id: repoId } });
      if (!existing) return null;

      if (existing.archivedAt) {
        await tx.repository.update({
          where: { id: repoId },
          data: { archivedAt: null, updatedAt: now }
        });
      }

      const tasksResult = await tx.task.updateMany({
        where: { repoId, archivedAt: { not: null } },
        data: { archivedAt: null }
      });
      const groupsResult = await tx.taskGroup.updateMany({
        where: { repoId, archivedAt: { not: null } },
        data: { archivedAt: null }
      });

      const row = await tx.repository.findUnique({ where: { id: repoId } });
      if (!row) return null;
      return {
        repo: recordToRepository(row),
        tasksRestored: tasksResult.count ?? 0,
        taskGroupsRestored: groupsResult.count ?? 0
      };
    });
  }

  async deleteRepo(id: string): Promise<Repository | null> {
    // Delete repo plus related tasks/groups to avoid orphaned data. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    const repoId = String(id ?? '').trim();
    return db.$transaction(async (tx) => {
      const existing = await tx.repository.findUnique({ where: { id: repoId } });
      if (!existing) return null;

      await tx.task.deleteMany({ where: { repoId } });
      await tx.taskGroup.deleteMany({ where: { repoId } });
      await tx.repoMember.deleteMany({ where: { repoId } });
      await tx.repoMemberInvite.deleteMany({ where: { repoId } });
      await tx.repoRobot.deleteMany({ where: { repoId } });
      await tx.repoAutomationConfig.deleteMany({ where: { repoId } });
      await tx.repoWebhookDelivery.deleteMany({ where: { repoId } });

      const deleted = await tx.repository.delete({ where: { id: repoId } });
      return recordToRepository(deleted);
    });
  }

  async createRepositoryTx(
    tx: Prisma.TransactionClient,
    _actor: { id: string } | null,
    input: CreateRepositoryInput
  ): Promise<{ repo: Repository; webhookSecret: string }> {
    const id = randomUUID();
    const now = new Date();
    const provider = input.provider;
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('name is required');

    const externalId = input.externalId === undefined ? null : input.externalId;
    const apiBaseUrl = input.apiBaseUrl === undefined ? null : input.apiBaseUrl;
    const branchesJson = input.branches === undefined ? null : normalizeBranches(input.branches);
    const enabled = input.enabled === undefined ? true : Boolean(input.enabled);
    const webhookSecret = (input.webhookSecret ?? '').trim() || generateWebhookSecret();

    const row = await tx.repository.create({
      data: {
        id,
        provider,
        name,
        externalId,
        apiBaseUrl,
        branches: branchesJson as any,
        webhookSecret,
        enabled,
        webhookVerifiedAt: null,
        // Initialize archivedAt as NULL so new repos appear in the default (active) list. qnp1mtxhzikhbi0xspbc
        archivedAt: null,
        repoProviderCredentials: Prisma.DbNull,
        modelProviderCredentials: Prisma.DbNull,
        // Initialize repo preview env storage as null on create. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
        previewEnv: Prisma.DbNull,
        createdAt: now,
        updatedAt: now
      }
    });

    return { repo: recordToRepository(row), webhookSecret };
  }

  async createRepository(
    actor: { id: string } | null,
    input: CreateRepositoryInput
  ): Promise<{ repo: Repository; webhookSecret: string }> {
    return db.$transaction((tx) => this.createRepositoryTx(tx, actor, input));
  }

  async updateRepository(
    id: string,
    input: UpdateRepositoryInput
  ): Promise<{ repo: Repository; webhookSecret?: string | null } | null> {
    const now = new Date();
    const existing = await this.getByIdWithSecret(id);
    if (!existing) return null;

    const isVerified = Boolean(existing.repo.webhookVerifiedAt);
    const existingExternalId = (existing.repo.externalId ?? null) as string | null;
    const existingApiBaseUrl = (existing.repo.apiBaseUrl ?? null) as string | null;

    if (isVerified && existingExternalId && input.externalId !== undefined) {
      const next = input.externalId;
      if (next !== existingExternalId) {
        throw new Error('externalId is locked after webhook verification');
      }
    }
    if (isVerified && existingApiBaseUrl && input.apiBaseUrl !== undefined) {
      const next = input.apiBaseUrl;
      if (next !== existingApiBaseUrl) {
        throw new Error('apiBaseUrl is locked after webhook verification');
      }
    }

    const nextName = input.name === undefined ? existing.repo.name : String(input.name).trim();
    if (!nextName) throw new Error('name is required');

    const nextExternalId = input.externalId === undefined ? existing.repo.externalId ?? null : input.externalId;
    const nextApiBaseUrl = input.apiBaseUrl === undefined ? existing.repo.apiBaseUrl ?? null : input.apiBaseUrl;
    const nextBranches =
      input.branches === undefined ? existing.repo.branches ?? null : normalizeBranches(input.branches);
    const nextEnabled = input.enabled === undefined ? existing.repo.enabled : Boolean(input.enabled);

    const existingRepoScopedCredentials = await this.getRepoScopedCredentials(id);
    if (!existingRepoScopedCredentials) return null;
    // Load repo preview env config so updates can merge and preserve secrets. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    const existingPreviewEnv = await this.getRepoPreviewEnvConfig(id);
    if (!existingPreviewEnv) return null;

    const mergeRepoProviderCredential = (
      current: RepoScopedRepoProviderCredentials,
      patch: UpdateRepositoryInput['repoProviderCredential']
    ): unknown => {
      const toJson = (value: RepoScopedRepoProviderCredentials): Record<string, unknown> | null => {
        const profiles = (value.profiles ?? []).map((p) => ({
          id: p.id,
          remark: p.remark,
          ...(String(p.token ?? '').trim() ? { token: String(p.token ?? '').trim() } : {}),
          ...(String(p.cloneUsername ?? '').trim() ? { cloneUsername: String(p.cloneUsername ?? '').trim() } : {})
        }));
        const defaultProfileId = String(value.defaultProfileId ?? '').trim();
        const out: Record<string, unknown> = {
          profiles
        };
        if (defaultProfileId) out.defaultProfileId = defaultProfileId;
        return profiles.length ? out : null;
      };

      if (patch === undefined) return toJson(current);
      if (patch === null) return null;

      const map = new Map<string, RepoScopedRepoProviderCredentialProfile>();
      (current.profiles ?? []).forEach((p) => {
        if (!p.id) return;
        map.set(p.id, { ...p });
      });

      const removeIds = Array.isArray(patch.removeProfileIds) ? patch.removeProfileIds : [];
      removeIds
        .map((id) => asTrimmedString(id))
        .filter(Boolean)
        .forEach((id) => map.delete(id));

      const patches = Array.isArray(patch.profiles) ? patch.profiles : [];
      patches.forEach((profilePatch) => {
        if (!isRecord(profilePatch)) return;
        const patchId = asTrimmedString(profilePatch.id) || randomUUID();
        const existing = map.get(patchId);
        const currentRemark = existing?.remark ?? '';
        const currentToken = existing?.token;
        const currentCloneUsername = existing?.cloneUsername;

        const remark =
          profilePatch.remark === undefined
            ? currentRemark
            : profilePatch.remark === null
              ? ''
              : asTrimmedString(profilePatch.remark);
        if (!remark) throw new Error('repo provider credential profile remark is required');

        const token =
          profilePatch.token === undefined
            ? currentToken
            : profilePatch.token === null
              ? undefined
              : asTrimmedString(profilePatch.token) || undefined;
        const cloneUsername =
          profilePatch.cloneUsername === undefined
            ? currentCloneUsername
            : profilePatch.cloneUsername === null
              ? undefined
              : asTrimmedString(profilePatch.cloneUsername) || undefined;

        map.set(patchId, {
          id: patchId,
          remark,
          token: token ? token : undefined,
          cloneUsername: cloneUsername ? cloneUsername : undefined
        });
      });

      const requestedDefault =
        patch.defaultProfileId === undefined
          ? (current.defaultProfileId ?? undefined)
          : patch.defaultProfileId === null
            ? undefined
            : asTrimmedString(patch.defaultProfileId);

      const profiles = Array.from(map.values());
      const defaultProfileId =
        requestedDefault && profiles.some((p) => p.id === requestedDefault) ? requestedDefault : undefined;

      return toJson({ profiles, defaultProfileId });
    };

    const mergeModelProviderCredential = (
      current: RepoScopedModelProviderCredentials,
      patch: UpdateRepositoryInput['modelProviderCredential']
    ): unknown => {
      const toJson = (value: RepoScopedModelProviderCredentials): Record<string, unknown> | null => {
        const json: Record<string, unknown> = {};
        const add = (key: string, provider: RepoScopedModelProviderCredentialsByProvider) => {
          const profiles = (provider.profiles ?? []).map((p) => ({
            id: p.id,
            remark: p.remark,
            ...(String(p.apiKey ?? '').trim() ? { apiKey: String(p.apiKey ?? '').trim() } : {}),
            ...(String(p.apiBaseUrl ?? '').trim() ? { apiBaseUrl: String(p.apiBaseUrl ?? '').trim() } : {})
          }));
          const defaultProfileId = String(provider.defaultProfileId ?? '').trim();
          if (!profiles.length) return;
          json[key] = {
            profiles,
            ...(defaultProfileId ? { defaultProfileId } : {})
          };
        };

        add(CODEX_PROVIDER_KEY, value.codex);
        add(CLAUDE_CODE_PROVIDER_KEY, value.claude_code);
        add(GEMINI_CLI_PROVIDER_KEY, value.gemini_cli);
        return Object.keys(json).length ? json : null;
      };

      if (patch === undefined) return toJson(current);
      if (patch === null) return null;

      const applyProviderUpdate = (
        currentProvider: RepoScopedModelProviderCredentialsByProvider,
        update: any
      ): RepoScopedModelProviderCredentialsByProvider => {
        if (update === null) return { profiles: [], defaultProfileId: undefined };
        if (update === undefined) return currentProvider;

        const map = new Map<string, RepoScopedModelProviderCredentialProfile>();
        (currentProvider.profiles ?? []).forEach((p) => {
          if (!p.id) return;
          map.set(p.id, { ...p });
        });

        const removeIds = Array.isArray((update as any).removeProfileIds) ? ((update as any).removeProfileIds as any[]) : [];
        removeIds
          .map((id) => asTrimmedString(id))
          .filter(Boolean)
          .forEach((id) => map.delete(id));

        const patches = Array.isArray((update as any).profiles) ? ((update as any).profiles as any[]) : [];
        patches.forEach((profilePatch) => {
          if (!isRecord(profilePatch)) return;
          const patchId = asTrimmedString(profilePatch.id) || randomUUID();
          const existing = map.get(patchId);
          const currentRemark = existing?.remark ?? '';
          const currentApiKey = existing?.apiKey;
          const currentApiBaseUrl = existing?.apiBaseUrl;

          const remark =
            profilePatch.remark === undefined
              ? currentRemark
              : profilePatch.remark === null
                ? ''
                : asTrimmedString(profilePatch.remark);
          if (!remark) throw new Error('model provider credential profile remark is required');

          const apiKey =
            profilePatch.apiKey === undefined
              ? currentApiKey
              : profilePatch.apiKey === null
                ? undefined
                : asTrimmedString(profilePatch.apiKey) || undefined;

          const apiBaseUrl =
            profilePatch.apiBaseUrl === undefined
              ? currentApiBaseUrl
              : profilePatch.apiBaseUrl === null
                ? undefined
                : normalizeHttpBaseUrl(profilePatch.apiBaseUrl);

          map.set(patchId, {
            id: patchId,
            remark,
            apiKey: apiKey ? apiKey : undefined,
            apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined
          });
        });

        const requestedDefault =
          (update as any).defaultProfileId === undefined
            ? (currentProvider.defaultProfileId ?? undefined)
            : (update as any).defaultProfileId === null
              ? undefined
              : asTrimmedString((update as any).defaultProfileId);

        const profiles = Array.from(map.values());
        const defaultProfileId =
          requestedDefault && profiles.some((p) => p.id === requestedDefault) ? requestedDefault : undefined;

        return { profiles, defaultProfileId };
      };

      // Change record: repo-scoped model provider credentials now support multiple profiles per provider.
      const next: RepoScopedModelProviderCredentials = {
        codex: applyProviderUpdate(current.codex, patch.codex),
        claude_code: applyProviderUpdate(current.claude_code, patch.claude_code),
        gemini_cli: applyProviderUpdate(current.gemini_cli, patch.gemini_cli)
      };

      return toJson(next);
    };

    // Merge repo preview env patches while preserving secrets and reserved-key rules. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    const mergePreviewEnvConfig = (current: RepoPreviewEnvConfig, patch: UpdateRepositoryInput['previewEnvConfig']): unknown => {
      const toJson = (value: RepoPreviewEnvConfig): Record<string, unknown> | null => {
        const variables = (value.variables ?? []).map((entry) => ({
          key: entry.key,
          value: entry.value,
          ...(entry.secret ? { secret: true } : {})
        }));
        return variables.length ? { variables } : null;
      };

      if (patch === undefined) return toJson(current);
      if (patch === null) return null;

      const map = new Map<string, RepoPreviewEnvVar>();
      (current.variables ?? []).forEach((entry) => {
        if (!entry.key) return;
        map.set(entry.key, { ...entry });
      });

      const removeKeys = Array.isArray(patch.removeKeys) ? patch.removeKeys : [];
      for (const rawKey of removeKeys) {
        // Ignore invalid or reserved keys during removals to keep deletes idempotent. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
        try {
          const normalized = normalizeRepoEnvKey(rawKey);
          map.delete(normalized);
        } catch {
          continue;
        }
      }

      const entries = Array.isArray(patch.entries) ? patch.entries : [];
      for (const entryPatch of entries) {
        if (!isRecord(entryPatch)) continue;
        const key = normalizeRepoEnvKey(entryPatch.key);
        const existing = map.get(key);
        if (entryPatch.value === null) {
          map.delete(key);
          continue;
        }
        // Default preview env variables to secret-only storage (no toggle). docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
        const nextSecret = true;
        const rawValue = entryPatch.value === undefined ? undefined : asTrimmedString(entryPatch.value);
        const nextValue = rawValue === undefined ? existing?.value : rawValue || undefined;
        if (!nextValue) {
          throw new Error(`repo env value is required for "${key}"`);
        }
        if (envValueHasFixedPort(nextValue)) {
          throw new Error(`repo env "${key}" must not hardcode local preview ports`);
        }
        map.set(key, { key, value: nextValue, secret: nextSecret ? true : undefined });
      }

      const variables = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
      return toJson({ variables });
    };

    const nextRepoProviderCredentialsJson = mergeRepoProviderCredential(
      existingRepoScopedCredentials.repoProvider,
      input.repoProviderCredential
    );
    const nextModelProviderCredentialsJson = mergeModelProviderCredential(
      existingRepoScopedCredentials.modelProvider,
      input.modelProviderCredential
    );
    const nextPreviewEnvJson = mergePreviewEnvConfig(existingPreviewEnv.raw, input.previewEnvConfig); // Merge repo preview env updates for persistence. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302

    const nextWebhookSecret = input.webhookSecret === undefined ? existing.webhookSecret : input.webhookSecret;

    const row = await db.repository.update({
      where: { id },
      data: {
        name: nextName,
        externalId: nextExternalId,
        apiBaseUrl: nextApiBaseUrl,
        branches: nextBranches as any,
        webhookSecret: nextWebhookSecret,
        repoProviderCredentials: nextRepoProviderCredentialsJson as any,
        modelProviderCredentials: nextModelProviderCredentialsJson as any,
        // Persist repo preview env config updates alongside repo settings. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
        previewEnv: nextPreviewEnvJson as any,
        enabled: nextEnabled,
        updatedAt: now
      }
    });

    return {
      repo: recordToRepository(row),
      ...(input.webhookSecret !== undefined ? { webhookSecret: row.webhookSecret ?? null } : {})
    };
  }
}
