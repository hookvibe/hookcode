import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { db } from '../../db';
import type { RepoRobot, RobotPermission, RobotDefaultBranchRole } from '../../types/repoRobot';
import {
  CODEX_PROVIDER_KEY,
  mergeCodexRobotProviderConfig,
  normalizeCodexRobotProviderConfig,
  toPublicCodexRobotProviderConfig
} from '../../modelProviders/codex';
import {
  CLAUDE_CODE_PROVIDER_KEY,
  mergeClaudeCodeRobotProviderConfig,
  normalizeClaudeCodeRobotProviderConfig,
  toPublicClaudeCodeRobotProviderConfig
} from '../../modelProviders/claudeCode';
import {
  GEMINI_CLI_PROVIDER_KEY,
  mergeGeminiCliRobotProviderConfig,
  normalizeGeminiCliRobotProviderConfig,
  toPublicGeminiCliRobotProviderConfig
} from '../../modelProviders/geminiCli';
import { inferRobotPermission } from '../../services/robotPermission';

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const normalizeRobotName = (name: string): string => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
};

const normalizePermission = (value: string): RobotPermission => {
  const raw = value.trim().toLowerCase();
  if (raw === 'read' || raw === 'write') return raw;
  throw new Error('permission must be read or write');
};

const normalizeDefaultBranchRole = (value: unknown): RobotDefaultBranchRole | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'main' || raw === 'dev' || raw === 'test') return raw;
  return undefined;
};

const normalizeDefaultBranch = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  return raw ? raw : undefined;
};

const normalizeLanguage = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  return raw ? raw : undefined;
};

const normalizeModelProvider = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return CODEX_PROVIDER_KEY;
  if (raw === CODEX_PROVIDER_KEY) return CODEX_PROVIDER_KEY;
  // Change record: allow selecting Claude Code as a model provider for repo robots.
  if (raw === CLAUDE_CODE_PROVIDER_KEY) return CLAUDE_CODE_PROVIDER_KEY;
  // Change record: allow selecting Gemini CLI as a model provider for repo robots.
  if (raw === GEMINI_CLI_PROVIDER_KEY) return GEMINI_CLI_PROVIDER_KEY;
  throw new Error('modelProvider must be codex, claude_code, or gemini_cli');
};

const normalizeModelProviderConfig = (provider: string, value: unknown): any => {
  if (provider === CODEX_PROVIDER_KEY) return normalizeCodexRobotProviderConfig(value) as any;
  if (provider === CLAUDE_CODE_PROVIDER_KEY) return normalizeClaudeCodeRobotProviderConfig(value) as any;
  if (provider === GEMINI_CLI_PROVIDER_KEY) return normalizeGeminiCliRobotProviderConfig(value) as any;
  return null;
};

const mergeModelProviderConfig = (provider: string, params: { existing: unknown; next: unknown }): any => {
  if (provider === CODEX_PROVIDER_KEY) return mergeCodexRobotProviderConfig(params) as any;
  if (provider === CLAUDE_CODE_PROVIDER_KEY) return mergeClaudeCodeRobotProviderConfig(params) as any;
  if (provider === GEMINI_CLI_PROVIDER_KEY) return mergeGeminiCliRobotProviderConfig(params) as any;
  return normalizeModelProviderConfig(provider, params.next);
};

const toPublicModelProviderConfig = (provider: string, value: unknown): unknown => {
  if (provider === CODEX_PROVIDER_KEY) return toPublicCodexRobotProviderConfig(value);
  if (provider === CLAUDE_CODE_PROVIDER_KEY) return toPublicClaudeCodeRobotProviderConfig(value);
  if (provider === GEMINI_CLI_PROVIDER_KEY) return toPublicGeminiCliRobotProviderConfig(value);
  return undefined;
};

const recordToRobot = (row: any): RepoRobot => ({
  id: String(row.id),
  repoId: String(row.repoId),
  name: String(row.name),
  permission: normalizePermission(String(row.permission)),
  hasToken: Boolean((typeof row.token === 'string' ? row.token : '').trim()),
  repoCredentialProfileId: row.repoCredentialProfileId ?? undefined,
  cloneUsername: row.cloneUsername ?? undefined,
  repoTokenUserId: row.repoTokenUserId ?? undefined,
  repoTokenUsername: row.repoTokenUsername ?? undefined,
  repoTokenUserName: row.repoTokenUserName ?? undefined,
  repoTokenUserEmail: row.repoTokenUserEmail ?? undefined,
  repoTokenRepoRole: row.repoTokenRepoRole ?? undefined,
  repoTokenRepoRoleDetails: row.repoTokenRepoRoleJson ?? undefined,
  promptDefault: row.promptDefault ?? undefined,
  language: normalizeLanguage(row.language),
  modelProvider: row.modelProvider ? String(row.modelProvider) : CODEX_PROVIDER_KEY,
  modelProviderConfig: toPublicModelProviderConfig(row.modelProvider ? String(row.modelProvider) : CODEX_PROVIDER_KEY, row.modelProviderConfig),
  defaultBranch: normalizeDefaultBranch(row.defaultBranch),
  defaultBranchRole: normalizeDefaultBranchRole(row.defaultBranchRole),
  activatedAt: row.activatedAt ? toIso(row.activatedAt) : undefined,
  lastTestAt: row.lastTestAt ? toIso(row.lastTestAt) : undefined,
  lastTestOk: row.lastTestOk === null || row.lastTestOk === undefined ? undefined : Boolean(row.lastTestOk),
  lastTestMessage: row.lastTestMessage ?? undefined,
  enabled: Boolean(row.enabled),
  isDefault: Boolean(row.isDefault),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

export interface RepoRobotWithToken extends RepoRobot {
  token?: string;
  modelProviderConfigRaw?: unknown;
}

const recordToRobotWithToken = (row: any): RepoRobotWithToken => ({
  ...recordToRobot(row),
  token: row.token ?? undefined,
  modelProviderConfigRaw: row.modelProviderConfig ?? undefined
});

export interface CreateRepoRobotInput {
  name: string;
  token?: string | null;
  cloneUsername?: string | null;
  repoCredentialProfileId?: string | null;
  promptDefault: string;
  language?: string | null;
  modelProvider?: string;
  modelProviderConfig?: unknown;
  defaultBranch?: string | null;
  defaultBranchRole?: RobotDefaultBranchRole | null;
  isDefault?: boolean;
}

export interface UpdateRepoRobotInput {
  name?: string;
  token?: string | null;
  cloneUsername?: string | null;
  repoCredentialProfileId?: string | null;
  promptDefault?: string;
  language?: string | null;
  modelProvider?: string;
  modelProviderConfig?: unknown;
  defaultBranch?: string | null;
  defaultBranchRole?: RobotDefaultBranchRole | null;
  enabled?: boolean;
  isDefault?: boolean;
}

@Injectable()
export class RepoRobotService {
  async listByRepo(repoId: string): Promise<RepoRobot[]> {
    const rows = await db.repoRobot.findMany({
      where: { repoId },
      orderBy: { createdAt: 'asc' }
    });
    return rows.map(recordToRobot);
  }

  async listByRepoWithToken(repoId: string): Promise<RepoRobotWithToken[]> {
    const rows = await db.repoRobot.findMany({
      where: { repoId },
      orderBy: { createdAt: 'asc' }
    });
    return rows.map(recordToRobotWithToken);
  }

  async getById(id: string): Promise<RepoRobot | null> {
    const row = await db.repoRobot.findUnique({ where: { id } });
    return row ? recordToRobot(row) : null;
  }

  async getByIdWithToken(id: string): Promise<RepoRobotWithToken | null> {
    const row = await db.repoRobot.findUnique({ where: { id } });
    return row ? recordToRobotWithToken(row) : null;
  }

  async createRobot(
    actor: { id: string } | null,
    repoId: string,
    input: CreateRepoRobotInput
  ): Promise<RepoRobot> {
    const id = randomUUID();
    const now = new Date();
    const name = normalizeRobotName(String(input.name ?? ''));
    if (!name) throw new Error('name is required');

    const token = input.token === undefined ? null : input.token;
    const cloneUsername = input.cloneUsername === undefined ? null : input.cloneUsername;
    const repoCredentialProfileId = input.repoCredentialProfileId === undefined ? null : input.repoCredentialProfileId;
    const promptDefault = String(input.promptDefault ?? '').trim();
    if (!promptDefault) throw new Error('promptDefault is required');
    const language = input.language === undefined ? null : input.language ? String(input.language).trim() : null;
    const modelProvider = normalizeModelProvider(input.modelProvider);
    const modelProviderConfig = normalizeModelProviderConfig(modelProvider, input.modelProviderConfig);
    const permission = inferRobotPermission({ modelProvider, modelProviderConfig });
    const defaultBranch =
      input.defaultBranch === undefined ? null : input.defaultBranch ? String(input.defaultBranch).trim() : null;
    const defaultBranchRole = input.defaultBranchRole === undefined ? null : input.defaultBranchRole;
    // New robots default to "pending activation": they can only be enabled after the token test passes.
    const enabled = false;
    const isDefault = input.isDefault === undefined ? false : Boolean(input.isDefault);

    const row = await db.repoRobot.create({
      data: {
        id,
        repoId,
        name,
        permission,
        token,
        cloneUsername,
        repoCredentialProfileId: token ? null : repoCredentialProfileId,
        repoTokenUserId: null,
        repoTokenUsername: null,
        repoTokenUserName: null,
        repoTokenUserEmail: null,
        repoTokenRepoRole: null,
        repoTokenRepoRoleJson: Prisma.DbNull,
        promptDefault,
        language,
        modelProvider,
        modelProviderConfig,
        defaultBranchRole,
        defaultBranch,
        activatedAt: null,
        lastTestAt: null,
        lastTestOk: null,
        lastTestMessage: null,
        enabled,
        isDefault,
        createdAt: now,
        updatedAt: now
      }
    });
    return recordToRobot(row);
  }

  async updateRobot(id: string, input: UpdateRepoRobotInput): Promise<RepoRobot | null> {
    const now = new Date();
    const existing = await this.getByIdWithToken(id);
    if (!existing) return null;

    if (input.enabled === true) {
      throw new Error('robot must be activated by testing token');
    }

    const nextName =
      input.name === undefined ? existing.name : normalizeRobotName(String(input.name));
    if (!nextName) throw new Error('name is required');

    const existingToken = existing.token ?? null;
    const nextToken = input.token === undefined ? existingToken : input.token;
    const nextCloneUsername =
      input.cloneUsername === undefined ? existing.cloneUsername ?? null : input.cloneUsername;
    const nextRepoCredentialProfileId =
      input.repoCredentialProfileId === undefined ? existing.repoCredentialProfileId ?? null : input.repoCredentialProfileId;
    const nextPromptDefault =
      input.promptDefault === undefined ? String(existing.promptDefault ?? '').trim() : String(input.promptDefault ?? '').trim();
    if (!nextPromptDefault) throw new Error('promptDefault is required');
    const nextLanguage =
      input.language === undefined
        ? existing.language ?? null
        : input.language
          ? String(input.language).trim()
          : null;
    const nextModelProvider =
      input.modelProvider === undefined
        ? normalizeModelProvider(existing.modelProvider)
        : normalizeModelProvider(input.modelProvider);
    const nextModelProviderConfig =
      input.modelProviderConfig === undefined
        ? (existing.modelProviderConfigRaw ?? null)
        : mergeModelProviderConfig(nextModelProvider, { existing: existing.modelProviderConfigRaw ?? null, next: input.modelProviderConfig });
    const nextPermission = inferRobotPermission({ modelProvider: nextModelProvider, modelProviderConfig: nextModelProviderConfig });
    const nextDefaultBranch =
      input.defaultBranch === undefined
        ? existing.defaultBranch ?? null
        : input.defaultBranch
          ? String(input.defaultBranch).trim()
          : null;
    const nextDefaultBranchRole =
      input.defaultBranchRole === undefined
        ? existing.defaultBranchRole ?? null
        : input.defaultBranchRole;
    const profileChanged =
      input.repoCredentialProfileId !== undefined &&
      String(nextRepoCredentialProfileId ?? '').trim() !== String(existing.repoCredentialProfileId ?? '').trim();
    const tokenChanged = input.token !== undefined && nextToken !== existingToken;
    const credentialChanged = tokenChanged || profileChanged;
    const nextEnabled =
      credentialChanged ? false : input.enabled === undefined ? existing.enabled : Boolean(input.enabled);
    const nextIsDefault = input.isDefault === undefined ? existing.isDefault : Boolean(input.isDefault);
    const nextActivatedAt = credentialChanged ? null : existing.activatedAt ?? null;
    const nextLastTestAt = credentialChanged ? null : existing.lastTestAt ?? null;
    const nextLastTestOk = credentialChanged ? null : existing.lastTestOk ?? null;
    const nextLastTestMessage = credentialChanged ? null : existing.lastTestMessage ?? null;

    const nextTokenIntrospection = credentialChanged
      ? {
          repoTokenUserId: null,
          repoTokenUsername: null,
          repoTokenUserName: null,
          repoTokenUserEmail: null,
          repoTokenRepoRole: null,
          repoTokenRepoRoleJson: Prisma.DbNull
        }
      : {};

    const row = await db.repoRobot.update({
      where: { id },
      data: {
        name: nextName,
        permission: nextPermission,
        token: nextToken,
        cloneUsername: nextCloneUsername,
        repoCredentialProfileId: nextToken ? null : nextRepoCredentialProfileId,
        promptDefault: nextPromptDefault,
        language: nextLanguage,
        modelProvider: nextModelProvider,
        modelProviderConfig: nextModelProviderConfig as any,
        defaultBranch: nextDefaultBranch,
        defaultBranchRole: nextDefaultBranchRole as any,
        activatedAt: nextActivatedAt ? new Date(nextActivatedAt) : nextActivatedAt,
        lastTestAt: nextLastTestAt ? new Date(nextLastTestAt) : nextLastTestAt,
        lastTestOk: nextLastTestOk as any,
        lastTestMessage: nextLastTestMessage,
        ...nextTokenIntrospection,
        enabled: nextEnabled,
        isDefault: nextIsDefault,
        updatedAt: now
      }
    });
    return row ? recordToRobot(row) : null;
  }

  async recordTestResult(
    id: string,
    result: {
      ok: boolean;
      message?: string | null;
      tokenInfo?: {
        userId?: string;
        username?: string;
        name?: string;
        email?: string;
        repoRole?: string;
        repoRoleDetails?: unknown;
      } | null;
    }
  ): Promise<RepoRobot | null> {
    const now = new Date();
    const ok = Boolean(result.ok);
    const message = result.message === undefined ? null : result.message;
    const tokenInfo = result.tokenInfo ?? null;

    const existing = await db.repoRobot.findUnique({ where: { id }, select: { activatedAt: true } });
    if (!existing) return null;
    const activatedAt = ok ? existing.activatedAt ?? now : existing.activatedAt;
    const row = await db.repoRobot.update({
      where: { id },
      data: {
        lastTestAt: now,
        lastTestOk: ok,
        lastTestMessage: message,
        enabled: ok,
        activatedAt,
        ...(ok && tokenInfo
          ? {
              repoTokenUserId: tokenInfo.userId ?? null,
              repoTokenUsername: tokenInfo.username ?? null,
              repoTokenUserName: tokenInfo.name ?? null,
              repoTokenUserEmail: tokenInfo.email ?? null,
              repoTokenRepoRole: tokenInfo.repoRole ?? null,
              repoTokenRepoRoleJson:
                tokenInfo.repoRoleDetails === undefined || tokenInfo.repoRoleDetails === null
                  ? Prisma.DbNull
                  : (tokenInfo.repoRoleDetails as any)
            }
          : {}),
        updatedAt: now
      }
    });
    return row ? recordToRobot(row) : null;
  }

  async setDefaultRobot(repoId: string, robotId: string): Promise<void> {
    const current = await this.getById(robotId);
    if (!current) throw new Error('Robot not found');
    if (current.repoId !== repoId) throw new Error('Robot does not belong to repo');

    const now = new Date();
    await db.$transaction([
      db.repoRobot.updateMany({
        where: { repoId, permission: current.permission },
        data: { isDefault: false, updatedAt: now }
      }),
      db.repoRobot.update({
        where: { id: robotId },
        data: { isDefault: true, updatedAt: now }
      })
    ]);
  }

  async deleteRobot(id: string): Promise<boolean> {
    const result = await db.repoRobot.deleteMany({ where: { id } });
    return result.count > 0;
  }
}
