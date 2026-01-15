import { randomUUID, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { Prisma } from '@prisma/client';
import type { RepoProvider, Repository, RepositoryBranch } from '../../types/repository';
import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY } from '../../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY } from '../../modelProviders/geminiCli';
import { normalizeHttpBaseUrl } from '../../utils/url';

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

  async listAll(): Promise<Repository[]> {
    const rows = await db.repository.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return rows.map(recordToRepository);
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
        repoProviderCredentials: Prisma.DbNull,
        modelProviderCredentials: Prisma.DbNull,
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

    const nextRepoProviderCredentialsJson = mergeRepoProviderCredential(
      existingRepoScopedCredentials.repoProvider,
      input.repoProviderCredential
    );
    const nextModelProviderCredentialsJson = mergeModelProviderCredential(
      existingRepoScopedCredentials.modelProvider,
      input.modelProviderCredential
    );

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
