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
import { normalizeHttpBaseUrl } from '../../utils/url';

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
  // Business context: user-scoped model provider credentials can include multiple profiles per provider.
  codex?: UserModelProviderCredentials;
  claude_code?: UserModelProviderCredentials;
  gemini_cli?: UserModelProviderCredentials;
  gitlab?: UserRepoProviderCredentials;
  github?: UserRepoProviderCredentials;
  [key: string]: any;
}

export interface UserModelProviderCredentialProfile {
  id: string;
  remark: string;
  apiBaseUrl?: string;
  apiKey?: string;
}

export interface UserModelProviderCredentials {
  profiles: UserModelProviderCredentialProfile[];
  defaultProfileId?: string;
}

export interface UserRepoProviderCredentialProfile {
  id: string;
  remark: string;
  token?: string;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentials {
  profiles: UserRepoProviderCredentialProfile[];
  defaultProfileId?: string;
}

export interface UserModelCredentialsPublic {
  codex: UserModelProviderCredentialsPublic;
  claude_code: UserModelProviderCredentialsPublic;
  gemini_cli: UserModelProviderCredentialsPublic;
  gitlab?: UserRepoProviderCredentialsPublic;
  github?: UserRepoProviderCredentialsPublic;
  [key: string]: any;
}

export interface UserModelProviderCredentialProfilePublic {
  id: string;
  remark: string;
  apiBaseUrl?: string;
  hasApiKey: boolean;
}

export interface UserModelProviderCredentialsPublic {
  profiles: UserModelProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

export interface UserRepoProviderCredentialProfilePublic {
  id: string;
  remark: string;
  hasToken: boolean;
  cloneUsername?: string;
}

export interface UserRepoProviderCredentialsPublic {
  profiles: UserRepoProviderCredentialProfilePublic[];
  defaultProfileId?: string;
}

const normalizeModelProviderCredentials = (raw: unknown): UserModelProviderCredentials => {
  if (!isRecord(raw)) return { profiles: [], defaultProfileId: undefined };

  const profilesRaw = Array.isArray(raw.profiles) ? raw.profiles : [];
  const profiles: UserModelProviderCredentialProfile[] = profilesRaw
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

  return {
    profiles,
    defaultProfileId: defaultValid ? defaultProfileId : undefined
  };
};

const normalizeRepoProviderCredentials = (raw: unknown): UserRepoProviderCredentials | undefined => {
  if (!isRecord(raw)) return undefined;

  const profilesRaw = Array.isArray(raw.profiles) ? raw.profiles : [];
  const profiles: UserRepoProviderCredentialProfile[] = profilesRaw
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

  return {
    profiles,
    defaultProfileId: defaultValid ? defaultProfileId : undefined
  };
};

const normalizeUserModelCredentials = (raw: unknown): UserModelCredentials => {
  // Business intent: always return a stable object shape so callers can rely on `profiles` arrays.
  if (!isRecord(raw)) {
    return {
      codex: { profiles: [], defaultProfileId: undefined },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined },
      gitlab: { profiles: [], defaultProfileId: undefined },
      github: { profiles: [], defaultProfileId: undefined }
    };
  }

  const codex = normalizeModelProviderCredentials(raw[CODEX_PROVIDER_KEY]);
  const claude_code = normalizeModelProviderCredentials(raw[CLAUDE_CODE_PROVIDER_KEY]);
  const gemini_cli = normalizeModelProviderCredentials(raw[GEMINI_CLI_PROVIDER_KEY]);
  const gitlab = normalizeRepoProviderCredentials(raw.gitlab) ?? { profiles: [], defaultProfileId: undefined };
  const github = normalizeRepoProviderCredentials(raw.github) ?? { profiles: [], defaultProfileId: undefined };

  return { codex, claude_code, gemini_cli, gitlab, github };
};

const toPublicUserModelCredentials = (raw: unknown): UserModelCredentialsPublic => {
  const normalized = normalizeUserModelCredentials(raw);
  const toPublicModelProvider = (creds: UserModelProviderCredentials | undefined): UserModelProviderCredentialsPublic => {
    const profiles = (creds?.profiles ?? []).map((p) => {
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

  const toPublicRepoProvider = (creds: UserRepoProviderCredentials | undefined): UserRepoProviderCredentialsPublic => {
    const profiles = (creds?.profiles ?? []).map((p) => {
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
    const defaultProfileId = (creds?.defaultProfileId ?? '').trim();
    const defaultValid = defaultProfileId && profiles.some((p) => p.id === defaultProfileId);
    return { profiles, defaultProfileId: defaultValid ? defaultProfileId : undefined };
  };
  return {
    codex: toPublicModelProvider(normalized.codex),
    claude_code: toPublicModelProvider(normalized.claude_code),
    gemini_cli: toPublicModelProvider(normalized.gemini_cli),
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
  gitlab?: {
    profiles?: Array<{
      id?: string;
      remark?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
  github?: {
    profiles?: Array<{
      id?: string;
      remark?: string | null;
      token?: string | null;
      cloneUsername?: string | null;
    }> | null;
    removeProfileIds?: string[] | null;
    defaultProfileId?: string | null;
  } | null;
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

    const applyModelProviderUpdate = (
      currentProvider: UserModelProviderCredentials | undefined,
      update:
        | UpdateUserModelCredentialsInput['codex']
        | UpdateUserModelCredentialsInput['claude_code']
        | UpdateUserModelCredentialsInput['gemini_cli']
    ): UserModelProviderCredentials => {
      // Business intent: allow wiping provider credentials without requiring backwards compatibility.
      if (update === null) return { profiles: [], defaultProfileId: undefined };

      const map = new Map<string, UserModelProviderCredentialProfile>();
      (currentProvider?.profiles ?? []).forEach((p) => {
        if (!p.id) return;
        map.set(p.id, { ...p });
      });

      const removeIds = Array.isArray(update?.removeProfileIds) ? update.removeProfileIds : [];
      removeIds
        .map((id) => asTrimmedString(id))
        .filter(Boolean)
        .forEach((id) => map.delete(id));

      const patches = Array.isArray(update?.profiles) ? update.profiles : [];
      patches.forEach((patch) => {
        if (!isRecord(patch)) return;
        const patchId = asTrimmedString(patch.id) || randomUUID();
        const existing = map.get(patchId);
        const currentRemark = existing?.remark ?? '';
        const currentApiKey = existing?.apiKey;
        const currentApiBaseUrl = existing?.apiBaseUrl;

        const remark =
          patch.remark === undefined
            ? currentRemark
            : patch.remark === null
              ? ''
              : asTrimmedString(patch.remark);
        if (!remark) {
          throw new Error('model provider credential profile remark is required');
        }

        const apiKey =
          patch.apiKey === undefined
            ? currentApiKey
            : patch.apiKey === null
              ? undefined
              : asTrimmedString(patch.apiKey);

        const apiBaseUrl =
          patch.apiBaseUrl === undefined
            ? currentApiBaseUrl
            : patch.apiBaseUrl === null
              ? undefined
              : normalizeHttpBaseUrl(patch.apiBaseUrl);

        map.set(patchId, {
          id: patchId,
          remark,
          apiKey: apiKey ? apiKey : undefined,
          apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined
        });
      });

      const requestedDefault =
        update?.defaultProfileId === undefined
          ? (currentProvider?.defaultProfileId ?? undefined)
          : update.defaultProfileId === null
            ? undefined
            : asTrimmedString(update.defaultProfileId);

      const profiles = Array.from(map.values());
      const defaultProfileId =
        requestedDefault && profiles.some((p) => p.id === requestedDefault) ? requestedDefault : undefined;

      return { profiles, defaultProfileId };
    };

    if (input.codex !== undefined) {
      // Change record: account-scoped Codex credentials now support multiple profiles.
      next.codex = applyModelProviderUpdate(current.codex, input.codex);
    }

    if (input.claude_code !== undefined) {
      // Change record: account-scoped Claude Code credentials now support multiple profiles + API Base URL.
      next.claude_code = applyModelProviderUpdate(current.claude_code, input.claude_code);
    }

    if (input.gemini_cli !== undefined) {
      // Change record: account-scoped Gemini CLI credentials now support multiple profiles + API Base URL.
      next.gemini_cli = applyModelProviderUpdate(current.gemini_cli, input.gemini_cli);
    }

    const applyRepoProviderUpdate = (
      currentProvider: UserRepoProviderCredentials | undefined,
      update: UpdateUserModelCredentialsInput['gitlab'] | UpdateUserModelCredentialsInput['github']
    ): UserRepoProviderCredentials => {
      // TypeScript note: `UpdateUserModelCredentialsInput['gitlab']` is optional, so `undefined` is possible at the type level.
      // Business intent: treat `undefined` as "no-op" and keep the current provider credentials.
      if (update === undefined) return currentProvider ?? { profiles: [], defaultProfileId: undefined };
      if (update === null) return { profiles: [], defaultProfileId: undefined };

      const map = new Map<string, UserRepoProviderCredentialProfile>();
      (currentProvider?.profiles ?? []).forEach((p) => {
        if (!p.id) return;
        map.set(p.id, { ...p });
      });

      const removeIds = Array.isArray(update.removeProfileIds) ? update.removeProfileIds : [];
      removeIds
        .map((id) => asTrimmedString(id))
        .filter(Boolean)
        .forEach((id) => map.delete(id));

      const patches = Array.isArray(update.profiles) ? update.profiles : [];
      patches.forEach((patch) => {
        if (!isRecord(patch)) return;
        const patchId = asTrimmedString(patch.id) || randomUUID();
        const existing = map.get(patchId);
        const currentRemark = existing?.remark ?? '';
        const currentToken = existing?.token;
        const currentCloneUsername = existing?.cloneUsername;

        const remark =
          patch.remark === undefined
            ? currentRemark
            : patch.remark === null
              ? ''
              : asTrimmedString(patch.remark);
        if (!remark) {
          throw new Error('repo provider credential profile remark is required');
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
          remark,
          token: token ? token : undefined,
          cloneUsername: cloneUsername ? cloneUsername : undefined
        });
      });

      const requestedDefault =
        update.defaultProfileId === undefined
          ? (currentProvider?.defaultProfileId ?? undefined)
          : update.defaultProfileId === null
            ? undefined
            : asTrimmedString(update.defaultProfileId);

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
