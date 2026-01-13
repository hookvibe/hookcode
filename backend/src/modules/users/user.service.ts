import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import dotenv from 'dotenv';
import { Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { db } from '../../db';
import { userBaseSelect, userRecordSelect, type UserBaseRow, type UserRecordRow } from '../../prisma/selectors';
import type { User } from '../../types/user';
import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY } from '../../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY } from '../../modelProviders/geminiCli';

dotenv.config();

/**
 * users table access layer (console account system):
 * - Used by `backend/src/routes/auth.ts` for login.
 * - Used by `backend/src/middlewares/auth.ts` for token -> user lookup and account status checks.
 * - Used by `backend/src/index.ts` to bootstrap the first account on first start (ensureBootstrapUser).
 */
interface UserRecord extends User {
  passwordHash: string;
  passwordSalt: string;
}

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const normalizeUsername = (input: string): string => input.trim();

const normalizeUsernameLower = (input: string): string => normalizeUsername(input).toLowerCase();

const userRecordToUser = (row: UserBaseRow): User => ({
  id: String(row.id),
  username: String(row.username),
  displayName: row.displayName ?? undefined,
  disabled: Boolean(row.disabled),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

const userRecordToUserRecord = (row: UserRecordRow): UserRecord => ({
  ...userRecordToUser(row),
  passwordHash: String(row.passwordHash),
  passwordSalt: String(row.passwordSalt)
});

const createSalt = (): string => randomBytes(16).toString('hex');

const deriveHash = (password: string, salt: string): string => {
  const buf = scryptSync(password, salt, 64);
  return buf.toString('hex');
};

const constantTimeEqualHex = (aHex: string, bHex: string): boolean => {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

const isNotFoundError = (err: unknown): boolean =>
  err instanceof PrismaClientKnownRequestError && err.code === 'P2025';

const isUniqueError = (err: unknown): boolean =>
  err instanceof PrismaClientKnownRequestError && err.code === 'P2002';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asTrimmedString = (value: unknown): string =>
  (typeof value === 'string' ? value : '').trim();

export interface UserModelCredentials {
  codex?: { apiBaseUrl?: string; apiKey?: string };
  claude_code?: { apiKey?: string };
  gemini_cli?: { apiKey?: string };
  gitlab?: UserRepoProviderCredentials;
  github?: UserRepoProviderCredentials;
  [key: string]: any;
}

export interface UserRepoProviderCredentialProfile {
  id: string;
  name: string;
  token?: string;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentials {
  profiles: UserRepoProviderCredentialProfile[];
  defaultProfileId?: string;
}

export interface UserModelCredentialsPublic {
  codex?: { apiBaseUrl?: string; hasApiKey: boolean };
  claude_code?: { hasApiKey: boolean };
  gemini_cli?: { hasApiKey: boolean };
  gitlab?: UserRepoProviderCredentialsPublic;
  github?: UserRepoProviderCredentialsPublic;
  [key: string]: any;
}

export interface UserRepoProviderCredentialProfilePublic {
  id: string;
  name: string;
  hasToken: boolean;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentialsPublic {
  profiles: UserRepoProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

const normalizeRepoProviderCredentials = (raw: unknown): UserRepoProviderCredentials | undefined => {
  if (!isRecord(raw)) return undefined;

  const profilesRaw = Array.isArray(raw.profiles) ? raw.profiles : null;
  if (profilesRaw) {
    const profiles: UserRepoProviderCredentialProfile[] = profilesRaw
      .map((item) => (isRecord(item) ? (item as Record<string, unknown>) : null))
      .filter(Boolean)
      .map((item) => {
        const id = asTrimmedString(item!.id);
        const name = asTrimmedString(item!.name);
        const token = asTrimmedString(item!.token);
        const cloneUsername = asTrimmedString(item!.cloneUsername);
        return {
          id,
          name,
          token: token ? token : undefined,
          cloneUsername: cloneUsername ? cloneUsername : undefined
        };
      })
      .filter((p) => p.id && p.name);

    const defaultProfileId = asTrimmedString(raw.defaultProfileId);
    const defaultValid = defaultProfileId && profiles.some((p) => p.id === defaultProfileId);

    return {
      profiles,
      defaultProfileId: defaultValid ? defaultProfileId : undefined
    };
  }

  // Legacy single-credential shape: `{ token, cloneUsername }`.
  const token = asTrimmedString(raw.token);
  const cloneUsername = asTrimmedString(raw.cloneUsername);
  if (!token && !cloneUsername) return { profiles: [], defaultProfileId: undefined };

  const legacyId = 'legacy';
  return {
    profiles: [
      {
        id: legacyId,
        name: 'legacy',
        token: token ? token : undefined,
        cloneUsername: cloneUsername ? cloneUsername : undefined
      }
    ],
    defaultProfileId: legacyId
  };
};

const normalizeUserModelCredentials = (raw: unknown): UserModelCredentials => {
  if (!isRecord(raw)) return {};
  const codexRaw = isRecord(raw[CODEX_PROVIDER_KEY]) ? (raw[CODEX_PROVIDER_KEY] as Record<string, unknown>) : null;
  const apiBaseUrl = codexRaw ? asTrimmedString(codexRaw.apiBaseUrl) : '';
  const apiKey = codexRaw ? asTrimmedString(codexRaw.apiKey) : '';
  const claudeRaw = isRecord(raw[CLAUDE_CODE_PROVIDER_KEY]) ? (raw[CLAUDE_CODE_PROVIDER_KEY] as Record<string, unknown>) : null;
  const claudeApiKey = claudeRaw ? asTrimmedString(claudeRaw.apiKey) : '';
  const geminiRaw = isRecord(raw[GEMINI_CLI_PROVIDER_KEY]) ? (raw[GEMINI_CLI_PROVIDER_KEY] as Record<string, unknown>) : null;
  const geminiApiKey = geminiRaw ? asTrimmedString(geminiRaw.apiKey) : '';
  const gitlab = normalizeRepoProviderCredentials(raw.gitlab);
  const github = normalizeRepoProviderCredentials(raw.github);
  return {
    codex: codexRaw
      ? {
          apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
          apiKey: apiKey ? apiKey : undefined
        }
      : undefined
    ,
    claude_code: claudeRaw
      ? {
          apiKey: claudeApiKey ? claudeApiKey : undefined
        }
      : undefined,
    gemini_cli: geminiRaw
      ? {
          apiKey: geminiApiKey ? geminiApiKey : undefined
        }
      : undefined,
    gitlab,
    github
  };
};

const toPublicUserModelCredentials = (raw: unknown): UserModelCredentialsPublic => {
  const normalized = normalizeUserModelCredentials(raw);
  const apiBaseUrl = (normalized.codex?.apiBaseUrl ?? '').trim();
  const apiKey = (normalized.codex?.apiKey ?? '').trim();
  const claudeApiKey = (normalized.claude_code?.apiKey ?? '').trim();
  const geminiApiKey = (normalized.gemini_cli?.apiKey ?? '').trim();

  const toPublicRepoProvider = (creds: UserRepoProviderCredentials | undefined): UserRepoProviderCredentialsPublic => {
    const profiles = (creds?.profiles ?? []).map((p) => {
      const token = (p.token ?? '').trim();
      const cloneUsername = (p.cloneUsername ?? '').trim();
      return {
        id: p.id,
        name: p.name,
        hasToken: Boolean(token),
        cloneUsername: cloneUsername ? cloneUsername : undefined
      };
    });
    const defaultProfileId = (creds?.defaultProfileId ?? '').trim();
    const defaultValid = defaultProfileId && profiles.some((p) => p.id === defaultProfileId);
    return { profiles, defaultProfileId: defaultValid ? defaultProfileId : undefined };
  };
  return {
    codex: normalized.codex
      ? {
          apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
          hasApiKey: Boolean(apiKey)
        }
      : { apiBaseUrl: undefined, hasApiKey: false }
    ,
    claude_code: { hasApiKey: Boolean(claudeApiKey) },
    gemini_cli: { hasApiKey: Boolean(geminiApiKey) },
    gitlab: toPublicRepoProvider(normalized.gitlab),
    github: toPublicRepoProvider(normalized.github)
  };
};

export interface CreateUserInput {
  username: string;
  password: string;
  displayName?: string;
}

export interface UpdateUserInput {
  displayName?: string | null;
  disabled?: boolean;
}

export interface UpdateUserModelCredentialsInput {
  codex?: {
    apiBaseUrl?: string | null;
    apiKey?: string | null;
  };
  claude_code?: {
    apiKey?: string | null;
  };
  gemini_cli?: {
    apiKey?: string | null;
  };
  gitlab?: {
    profiles?: Array<{
      id?: string;
      name?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  };
  github?: {
    profiles?: Array<{
      id?: string;
      name?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  };
}

@Injectable()
export class UserService {
  async getById(id: string): Promise<User | null> {
    const row = await db.user.findUnique({ where: { id }, select: userBaseSelect });
    return row ? userRecordToUser(row) : null;
  }

  async getModelCredentialsRaw(id: string): Promise<UserModelCredentials | null> {
    const row = await db.user.findUnique({ where: { id }, select: { modelCredentials: true } });
    if (!row) return null;
    return normalizeUserModelCredentials(row.modelCredentials);
  }

  async getDefaultUserCredentialsRaw(): Promise<{ userId: string; credentials: UserModelCredentials } | null> {
    const row = await db.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, modelCredentials: true }
    });
    if (!row) return null;
    return {
      userId: String(row.id),
      credentials: normalizeUserModelCredentials(row.modelCredentials)
    };
  }

  async getRecordById(id: string): Promise<UserRecord | null> {
    const row = await db.user.findUnique({ where: { id }, select: userRecordSelect });
    return row ? userRecordToUserRecord(row) : null;
  }

  async getByUsername(username: string): Promise<User | null> {
    const usernameLower = normalizeUsernameLower(username);
    const row = await db.user.findUnique({ where: { usernameLower }, select: userBaseSelect });
    return row ? userRecordToUser(row) : null;
  }

  async getRecordByUsername(username: string): Promise<UserRecord | null> {
    const usernameLower = normalizeUsernameLower(username);
    const row = await db.user.findUnique({ where: { usernameLower }, select: userRecordSelect });
    return row ? userRecordToUserRecord(row) : null;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const username = normalizeUsername(input.username);
    const usernameLower = normalizeUsernameLower(input.username);
    if (!username) throw new Error('username is required');
    if (!input.password) throw new Error('password is required');

    const salt = createSalt();
    const passwordHash = deriveHash(input.password, salt);
    const now = new Date();
    const id = randomUUID();

    try {
      const row = await db.user.create({
        data: {
          id,
          username,
          usernameLower,
          displayName: input.displayName ?? null,
          passwordHash,
          passwordSalt: salt,
          disabled: false,
          createdAt: now,
          updatedAt: now
        },
        select: userBaseSelect
      });
      return userRecordToUser(row);
    } catch (err) {
      if (isUniqueError(err)) {
        throw new Error('username already exists');
      }
      throw err;
    }
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
    const now = new Date();
    const existing = await this.getRecordById(id);
    if (!existing) return null;

    const nextDisplayName =
      input.displayName === undefined ? existing.displayName ?? null : input.displayName;
    const nextDisabled = input.disabled === undefined ? existing.disabled : Boolean(input.disabled);

    try {
      const row = await db.user.update({
        where: { id },
        data: {
          displayName: nextDisplayName,
          disabled: nextDisabled,
          updatedAt: now
        },
        select: userBaseSelect
      });
      return userRecordToUser(row);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async getModelCredentials(id: string): Promise<UserModelCredentialsPublic | null> {
    const row = await db.user.findUnique({ where: { id }, select: { modelCredentials: true } });
    if (!row) return null;
    return toPublicUserModelCredentials(row.modelCredentials);
  }

  async updateModelCredentials(id: string, input: UpdateUserModelCredentialsInput): Promise<UserModelCredentialsPublic | null> {
    const now = new Date();
    const existing = await db.user.findUnique({ where: { id }, select: { modelCredentials: true } });
    if (!existing) return null;

    const current = normalizeUserModelCredentials(existing.modelCredentials as any);
    const next: UserModelCredentials = { ...current };

    if (input.codex !== undefined) {
      const currentCodex = current.codex ?? {};
      const apiBaseUrl =
        input.codex.apiBaseUrl === undefined
          ? currentCodex.apiBaseUrl
          : input.codex.apiBaseUrl === null
            ? undefined
            : asTrimmedString(input.codex.apiBaseUrl);
      const apiKey =
        input.codex.apiKey === undefined
          ? currentCodex.apiKey
          : input.codex.apiKey === null
            ? undefined
            : asTrimmedString(input.codex.apiKey);
      next.codex = {
        apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
        apiKey: apiKey ? apiKey : undefined
      };
    }

    if (input.claude_code !== undefined) {
      // Change record: allow users to configure Claude Code API key side-by-side with Codex credentials.
      const currentClaude = current.claude_code ?? {};
      const apiKey =
        input.claude_code.apiKey === undefined
          ? currentClaude.apiKey
          : input.claude_code.apiKey === null
            ? undefined
            : asTrimmedString(input.claude_code.apiKey);
      next.claude_code = { apiKey: apiKey ? apiKey : undefined };
    }

    if (input.gemini_cli !== undefined) {
      // Change record: allow users to configure Gemini CLI API key side-by-side with Codex/Claude Code credentials.
      const currentGemini = current.gemini_cli ?? {};
      const apiKey =
        input.gemini_cli.apiKey === undefined
          ? currentGemini.apiKey
          : input.gemini_cli.apiKey === null
            ? undefined
            : asTrimmedString(input.gemini_cli.apiKey);
      next.gemini_cli = { apiKey: apiKey ? apiKey : undefined };
    }

    const applyRepoProviderUpdate = (
      currentProvider: UserRepoProviderCredentials | undefined,
      update: UpdateUserModelCredentialsInput['gitlab'] | UpdateUserModelCredentialsInput['github']
    ): UserRepoProviderCredentials => {
      const map = new Map<string, UserRepoProviderCredentialProfile>();
      (currentProvider?.profiles ?? []).forEach((p) => {
        if (!p.id) return;
        map.set(p.id, { ...p });
      });

      const removeIds = Array.isArray((update as any)?.removeProfileIds) ? ((update as any).removeProfileIds as any[]) : [];
      removeIds
        .map((id) => asTrimmedString(id))
        .filter(Boolean)
        .forEach((id) => map.delete(id));

      const patches = Array.isArray((update as any)?.profiles) ? ((update as any).profiles as any[]) : [];
      patches.forEach((patch) => {
        if (!isRecord(patch)) return;
        const patchId = asTrimmedString(patch.id) || randomUUID();
        const existing = map.get(patchId);
        const currentName = existing?.name ?? '';
        const currentToken = existing?.token;
        const currentCloneUsername = existing?.cloneUsername;

        const name =
          patch.name === undefined
            ? currentName
            : patch.name === null
              ? ''
              : asTrimmedString(patch.name);
        if (!name) {
          throw new Error('repo provider credential profile name is required');
        }

        const token =
          patch.token === undefined
            ? currentToken
            : patch.token === null
              ? undefined
              : asTrimmedString(patch.token);
        const cloneUsername =
          patch.cloneUsername === undefined
            ? currentCloneUsername
            : patch.cloneUsername === null
              ? undefined
              : asTrimmedString(patch.cloneUsername);

        map.set(patchId, {
          id: patchId,
          name,
          token: token ? token : undefined,
          cloneUsername: cloneUsername ? cloneUsername : undefined
        });
      });

      const requestedDefault =
        (update as any)?.defaultProfileId === undefined
          ? (currentProvider?.defaultProfileId ?? undefined)
          : (update as any).defaultProfileId === null
            ? undefined
            : asTrimmedString((update as any).defaultProfileId);

      const profiles = Array.from(map.values());
      const defaultProfileId = requestedDefault && profiles.some((p) => p.id === requestedDefault) ? requestedDefault : undefined;

      return { profiles, defaultProfileId };
    };

    if (input.gitlab !== undefined) {
      next.gitlab = applyRepoProviderUpdate(current.gitlab, input.gitlab);
    }

    if (input.github !== undefined) {
      next.github = applyRepoProviderUpdate(current.github, input.github);
    }

    const row = await db.user.update({
      where: { id },
      data: { modelCredentials: next as any, updatedAt: now },
      select: { modelCredentials: true }
    });
    return toPublicUserModelCredentials(row.modelCredentials);
  }

  async setPassword(id: string, newPassword: string): Promise<boolean> {
    if (!newPassword) throw new Error('password is required');
    const user = await this.getRecordById(id);
    if (!user) return false;

    const salt = createSalt();
    const passwordHash = deriveHash(newPassword, salt);
    const now = new Date();
    await db.user.update({
      where: { id },
      data: { passwordHash, passwordSalt: salt, updatedAt: now }
    });
    return true;
  }

  async verifyPasswordDetailed(
    username: string,
    password: string
  ): Promise<
    | { ok: true; user: User }
    | {
        ok: false;
        reason: 'not_found' | 'disabled' | 'invalid_password';
      }
  > {
    const record = await this.getRecordByUsername(username);
    if (!record) return { ok: false, reason: 'not_found' };
    if (record.disabled) return { ok: false, reason: 'disabled' };
    const computed = deriveHash(password, record.passwordSalt);
    if (!constantTimeEqualHex(computed, record.passwordHash)) return { ok: false, reason: 'invalid_password' };
    const { passwordHash: _hash, passwordSalt: _salt, ...user } = record;
    return { ok: true, user };
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const result = await this.verifyPasswordDetailed(username, password);
    return result.ok ? result.user : null;
  }

  async ensureBootstrapUser(): Promise<void> {
    const enabledRaw = (process.env.AUTH_BOOTSTRAP_USER ?? process.env.AUTH_BOOTSTRAP_ADMIN ?? '').trim().toLowerCase();
    const enabled = !enabledRaw || enabledRaw === '1' || enabledRaw === 'true' || enabledRaw === 'yes' || enabledRaw === 'on';
    if (!enabled) return;

    const any = await db.user.findFirst({ select: { id: true } });
    if (any) return;

    const username = normalizeUsername(process.env.AUTH_USERNAME || process.env.AUTH_ADMIN_USERNAME || 'admin');
    const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
    const passwordFromEnv = (process.env.AUTH_PASSWORD || process.env.AUTH_ADMIN_PASSWORD || '').trim();
    const password = passwordFromEnv || (isProd ? '' : 'admin');
    if (!username || !password) {
      console.warn(
        '[user] missing AUTH_USERNAME/AUTH_PASSWORD and users table is empty; cannot auto-create bootstrap user'
      );
      return;
    }
    if (!passwordFromEnv && !isProd) {
      console.warn('[user] AUTH_PASSWORD is not configured; using default password "admin" (development only)');
    }

    try {
      await this.createUser({
        username,
        password,
        displayName: 'Owner'
      });
      console.log(`[user] initialized bootstrap user: ${username}`);
    } catch (err) {
      console.warn(
        '[user] failed to initialize bootstrap user (possible concurrent creation or username conflict)',
        err
      );
    }
  }

  // Backward-compatible alias (older deployments may still call this method name).
  async ensureBootstrapAdmin(): Promise<void> {
    return this.ensureBootstrapUser();
  }
}
