import { randomUUID, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { Prisma } from '@prisma/client';
import type { RepoProvider, Repository, RepositoryBranch } from '../../types/repository';
import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY } from '../../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY } from '../../modelProviders/geminiCli';

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

export interface RepoScopedRepoProviderCredential {
  token?: string;
  cloneUsername?: string;
}

export interface RepoScopedRepoProviderCredentialPublic {
  hasToken: boolean;
  cloneUsername?: string;
}

export interface RepoScopedModelProviderCredentials {
  codex?: { apiBaseUrl?: string; apiKey?: string };
  claude_code?: { apiKey?: string };
  gemini_cli?: { apiKey?: string };
  [key: string]: any;
}

export interface RepoScopedModelProviderCredentialsPublic {
  codex: { apiBaseUrl?: string; hasApiKey: boolean };
  claude_code: { hasApiKey: boolean };
  gemini_cli: { hasApiKey: boolean };
  [key: string]: any;
}

export interface RepoScopedCredentialsPublic {
  repoProvider: RepoScopedRepoProviderCredentialPublic;
  modelProvider: RepoScopedModelProviderCredentialsPublic;
}

const normalizeRepoScopedRepoProviderCredential = (raw: unknown): RepoScopedRepoProviderCredential => {
  if (!isRecord(raw)) return {};
  const token = asTrimmedString(raw.token);
  const cloneUsername = asTrimmedString(raw.cloneUsername);
  return {
    token: token ? token : undefined,
    cloneUsername: cloneUsername ? cloneUsername : undefined
  };
};

const toPublicRepoScopedRepoProviderCredential = (raw: unknown): RepoScopedRepoProviderCredentialPublic => {
  const normalized = normalizeRepoScopedRepoProviderCredential(raw);
  const token = (normalized.token ?? '').trim();
  const cloneUsername = (normalized.cloneUsername ?? '').trim();
  return {
    hasToken: Boolean(token),
    cloneUsername: cloneUsername ? cloneUsername : undefined
  };
};

const normalizeRepoScopedModelProviderCredentials = (raw: unknown): RepoScopedModelProviderCredentials => {
  if (!isRecord(raw)) return {};
  const codexRaw = isRecord(raw[CODEX_PROVIDER_KEY]) ? (raw[CODEX_PROVIDER_KEY] as Record<string, unknown>) : null;
  const apiBaseUrl = codexRaw ? asTrimmedString(codexRaw.apiBaseUrl) : '';
  const apiKey = codexRaw ? asTrimmedString(codexRaw.apiKey) : '';
  const claudeRaw = isRecord(raw[CLAUDE_CODE_PROVIDER_KEY]) ? (raw[CLAUDE_CODE_PROVIDER_KEY] as Record<string, unknown>) : null;
  const claudeApiKey = claudeRaw ? asTrimmedString(claudeRaw.apiKey) : '';
  const geminiRaw = isRecord(raw[GEMINI_CLI_PROVIDER_KEY]) ? (raw[GEMINI_CLI_PROVIDER_KEY] as Record<string, unknown>) : null;
  const geminiApiKey = geminiRaw ? asTrimmedString(geminiRaw.apiKey) : '';
  return {
    codex: codexRaw
      ? {
          apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
          apiKey: apiKey ? apiKey : undefined
        }
      : undefined,
    claude_code: claudeRaw
      ? {
          apiKey: claudeApiKey ? claudeApiKey : undefined
        }
      : undefined,
    gemini_cli: geminiRaw
      ? {
          apiKey: geminiApiKey ? geminiApiKey : undefined
        }
      : undefined
  };
};

const toPublicRepoScopedModelProviderCredentials = (raw: unknown): RepoScopedModelProviderCredentialsPublic => {
  const normalized = normalizeRepoScopedModelProviderCredentials(raw);
  const apiBaseUrl = (normalized.codex?.apiBaseUrl ?? '').trim();
  const apiKey = (normalized.codex?.apiKey ?? '').trim();
  const claudeApiKey = (normalized.claude_code?.apiKey ?? '').trim();
  const geminiApiKey = (normalized.gemini_cli?.apiKey ?? '').trim();
  return {
    codex: {
      apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
      hasApiKey: Boolean(apiKey)
    },
    claude_code: {
      hasApiKey: Boolean(claudeApiKey)
    },
    gemini_cli: {
      hasApiKey: Boolean(geminiApiKey)
    }
  };
};

const toPublicRepoScopedCredentials = (raw: {
  repoProvider: unknown;
  modelProvider: unknown;
}): RepoScopedCredentialsPublic => ({
  repoProvider: toPublicRepoScopedRepoProviderCredential(raw.repoProvider),
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
    token?: string | null;
    cloneUsername?: string | null;
  } | null;
  modelProviderCredential?: {
    codex?: {
      apiBaseUrl?: string | null;
      apiKey?: string | null;
    } | null;
    claude_code?: {
      apiKey?: string | null;
    } | null;
    gemini_cli?: {
      apiKey?: string | null;
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
    repoProvider: RepoScopedRepoProviderCredential;
    modelProvider: RepoScopedModelProviderCredentials;
    public: RepoScopedCredentialsPublic;
  } | null> {
    const row = await db.repository.findUnique({
      where: { id },
      select: { repoProviderCredentials: true, modelProviderCredentials: true }
    });
    if (!row) return null;
    const repoProvider = normalizeRepoScopedRepoProviderCredential(row.repoProviderCredentials);
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
      current: RepoScopedRepoProviderCredential,
      patch: UpdateRepositoryInput['repoProviderCredential']
    ): unknown => {
      if (patch === undefined) {
        return current.token || current.cloneUsername ? { ...current } : null;
      }
      if (patch === null) return null;
      const nextToken =
        patch.token === undefined
          ? current.token ?? undefined
          : patch.token === null
            ? undefined
            : asTrimmedString(patch.token) || undefined;
      const nextCloneUsername =
        patch.cloneUsername === undefined
          ? current.cloneUsername ?? undefined
          : patch.cloneUsername === null
            ? undefined
            : asTrimmedString(patch.cloneUsername) || undefined;
      if (!nextToken && !nextCloneUsername) return null;
      return { ...(nextToken ? { token: nextToken } : {}), ...(nextCloneUsername ? { cloneUsername: nextCloneUsername } : {}) };
    };

    const mergeModelProviderCredential = (
      current: RepoScopedModelProviderCredentials,
      patch: UpdateRepositoryInput['modelProviderCredential']
    ): unknown => {
      const toJson = (value: RepoScopedModelProviderCredentials): Record<string, unknown> | null => {
        const json: Record<string, unknown> = {};
        const codex = value.codex;
        const claude = value.claude_code;
        const gemini = value.gemini_cli;
        if (codex && (String(codex.apiBaseUrl ?? '').trim() || String(codex.apiKey ?? '').trim())) {
          json[CODEX_PROVIDER_KEY] = {
            ...(String(codex.apiBaseUrl ?? '').trim() ? { apiBaseUrl: String(codex.apiBaseUrl ?? '').trim() } : {}),
            ...(String(codex.apiKey ?? '').trim() ? { apiKey: String(codex.apiKey ?? '').trim() } : {})
          };
        }
        if (claude && String(claude.apiKey ?? '').trim()) {
          json[CLAUDE_CODE_PROVIDER_KEY] = { apiKey: String(claude.apiKey ?? '').trim() };
        }
        if (gemini && String(gemini.apiKey ?? '').trim()) {
          json[GEMINI_CLI_PROVIDER_KEY] = { apiKey: String(gemini.apiKey ?? '').trim() };
        }
        return Object.keys(json).length ? json : null;
      };

      if (patch === undefined) return toJson(current);
      if (patch === null) return null;

      // Change record: keep multiple model-provider credentials side-by-side (codex + claude_code + gemini_cli).
      const next: RepoScopedModelProviderCredentials = { ...current };

      if (patch.codex !== undefined) {
        if (patch.codex === null) {
          next.codex = undefined;
        } else {
          const currentCodex = current.codex ?? {};
          const nextApiBaseUrl =
            patch.codex.apiBaseUrl === undefined
              ? currentCodex.apiBaseUrl
              : patch.codex.apiBaseUrl === null
                ? undefined
                : asTrimmedString(patch.codex.apiBaseUrl) || undefined;
          const nextApiKey =
            patch.codex.apiKey === undefined
              ? currentCodex.apiKey
              : patch.codex.apiKey === null
                ? undefined
                : asTrimmedString(patch.codex.apiKey) || undefined;

          next.codex =
            nextApiBaseUrl || nextApiKey
              ? { ...(nextApiBaseUrl ? { apiBaseUrl: nextApiBaseUrl } : {}), ...(nextApiKey ? { apiKey: nextApiKey } : {}) }
              : undefined;
        }
      }

      if (patch.claude_code !== undefined) {
        if (patch.claude_code === null) {
          next.claude_code = undefined;
        } else {
          const currentClaude = current.claude_code ?? {};
          const nextApiKey =
            patch.claude_code.apiKey === undefined
              ? currentClaude.apiKey
              : patch.claude_code.apiKey === null
                ? undefined
                : asTrimmedString(patch.claude_code.apiKey) || undefined;
          next.claude_code = nextApiKey ? { apiKey: nextApiKey } : undefined;
        }
      }

      if (patch.gemini_cli !== undefined) {
        if (patch.gemini_cli === null) {
          next.gemini_cli = undefined;
        } else {
          const currentGemini = current.gemini_cli ?? {};
          const nextApiKey =
            patch.gemini_cli.apiKey === undefined
              ? currentGemini.apiKey
              : patch.gemini_cli.apiKey === null
                ? undefined
                : asTrimmedString(patch.gemini_cli.apiKey) || undefined;
          next.gemini_cli = nextApiKey ? { apiKey: nextApiKey } : undefined;
        }
      }

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
