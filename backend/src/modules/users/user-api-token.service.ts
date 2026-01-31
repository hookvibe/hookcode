import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { db } from '../../db';
import {
  PAT_SCOPE_GROUPS,
  buildPatScopeMap,
  normalizePatScopeEntries,
  normalizePatScopeMap,
  type PatScopeEntry,
  type PatScopeMap
} from '../auth/patScopes';
import type { PatAuthContext } from '../auth/authContext';

const PAT_PREFIX = 'hcpat_';
const PAT_TOKEN_BYTES = 32;
const PAT_PREFIX_LEN = 10; // e.g. "hcpat_Abcd" for display hints.
const PAT_LAST4_LEN = 4;
const PAT_MIN_EXPIRES_DAYS = 1;
const PAT_MAX_EXPIRES_DAYS = 3650;
const PAT_DEFAULT_EXPIRES_DAYS = 90;
const PAT_USAGE_TOUCH_COOLDOWN_MS = 60_000;

export interface UserApiTokenPublic {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenLast4?: string | null;
  scopes: PatScopeEntry[];
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
}

export interface CreateUserApiTokenInput {
  name: string;
  scopes: PatScopeEntry[];
  expiresInDays?: number | null;
}

export interface UpdateUserApiTokenInput {
  name?: string;
  scopes?: PatScopeEntry[];
  expiresInDays?: number | null;
}

export interface PatVerifyResult {
  auth: PatAuthContext;
  userId: string;
}

const toIso = (value: Date | null | undefined): string | null | undefined => {
  if (!value) return value === null ? null : undefined;
  return value.toISOString();
};

const isUniqueError = (err: unknown): boolean =>
  err instanceof PrismaClientKnownRequestError && err.code === 'P2002';

const hashToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

const buildTokenSeed = (): { token: string; tokenHash: string; tokenPrefix: string; tokenLast4: string } => {
  const raw = randomBytes(PAT_TOKEN_BYTES).toString('base64url');
  const token = `${PAT_PREFIX}${raw}`;
  const tokenPrefix = token.slice(0, PAT_PREFIX_LEN);
  const tokenLast4 = raw.slice(-PAT_LAST4_LEN);
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefix,
    tokenLast4
  };
};

const normalizeTokenName = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeExpiresInDays = (value: unknown): { expiresAt: Date | null; expiresInDays: number } => {
  if (value === null) return { expiresAt: null, expiresInDays: 0 };
  if (value === undefined) {
    const expiresAt = new Date(Date.now() + PAT_DEFAULT_EXPIRES_DAYS * 86400000);
    return { expiresAt, expiresInDays: PAT_DEFAULT_EXPIRES_DAYS };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('expiresInDays must be a number');
  }
  const days = Math.floor(parsed);
  if (days === 0) return { expiresAt: null, expiresInDays: 0 };
  if (days < PAT_MIN_EXPIRES_DAYS || days > PAT_MAX_EXPIRES_DAYS) {
    throw new Error(`expiresInDays must be between ${PAT_MIN_EXPIRES_DAYS} and ${PAT_MAX_EXPIRES_DAYS}`);
  }
  const expiresAt = new Date(Date.now() + days * 86400000);
  return { expiresAt, expiresInDays: days };
};

const normalizeScopeMap = (value: unknown): PatScopeMap => {
  const entries = normalizePatScopeEntries(value);
  const map = buildPatScopeMap(entries);
  if (Object.keys(map).length === 0) {
    throw new Error('api token scopes are required');
  }
  return map;
};

const scopeMapToEntries = (map: PatScopeMap): PatScopeEntry[] => {
  const entries: PatScopeEntry[] = [];
  for (const group of PAT_SCOPE_GROUPS) {
    const level = map[group];
    if (!level) continue;
    entries.push({ group, level });
  }
  return entries;
};

const toPublicToken = (row: any): UserApiTokenPublic => {
  const scopes = scopeMapToEntries(normalizePatScopeMap(row.scopes));
  return {
    id: String(row.id),
    name: String(row.name),
    tokenPrefix: String(row.tokenPrefix),
    tokenLast4: row.tokenLast4 ? String(row.tokenLast4) : null,
    scopes,
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
    expiresAt: toIso(row.expiresAt) ?? null,
    revokedAt: toIso(row.revokedAt) ?? null,
    lastUsedAt: toIso(row.lastUsedAt) ?? null
  };
};

@Injectable()
export class UserApiTokenService {
  // Issue and validate PAT tokens for API access. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
  async listTokens(userId: string): Promise<UserApiTokenPublic[]> {
    const rows = await db.userApiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map(toPublicToken);
  }

  async createToken(userId: string, input: CreateUserApiTokenInput): Promise<{ token: string; apiToken: UserApiTokenPublic }> {
    const name = normalizeTokenName(input?.name);
    if (!name) throw new Error('api token name is required');
    if (name.length > 80) throw new Error('api token name is too long');

    const scopeMap = normalizeScopeMap(input?.scopes);
    const { expiresAt } = normalizeExpiresInDays(input?.expiresInDays ?? undefined);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { token, tokenHash, tokenPrefix, tokenLast4 } = buildTokenSeed();
      try {
        const row = await db.userApiToken.create({
          data: {
            id: randomUUID(),
            userId,
            name,
            tokenHash,
            tokenPrefix,
            tokenLast4,
            scopes: scopeMap as any,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        return { token, apiToken: toPublicToken(row) };
      } catch (err) {
        if (!isUniqueError(err)) throw err;
      }
    }

    throw new Error('failed to issue api token');
  }

  async updateToken(userId: string, tokenId: string, input: UpdateUserApiTokenInput): Promise<UserApiTokenPublic | null> {
    const existing = await db.userApiToken.findFirst({ where: { id: tokenId, userId } });
    if (!existing) return null;
    if (existing.revokedAt) throw new Error('api token is revoked');

    const name = input?.name !== undefined ? normalizeTokenName(input.name) : undefined;
    if (name !== undefined && !name) throw new Error('api token name is required');
    if (name !== undefined && name.length > 80) throw new Error('api token name is too long');

    const scopes = input?.scopes !== undefined ? normalizeScopeMap(input.scopes) : undefined;

    let expiresAt: Date | null | undefined = undefined;
    if (input?.expiresInDays !== undefined) {
      const normalized = normalizeExpiresInDays(input.expiresInDays ?? null);
      expiresAt = normalized.expiresAt;
    }

    const row = await db.userApiToken.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(scopes !== undefined ? { scopes: scopes as any } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        updatedAt: new Date()
      }
    });

    return toPublicToken(row);
  }

  async revokeToken(userId: string, tokenId: string): Promise<UserApiTokenPublic | null> {
    const existing = await db.userApiToken.findFirst({ where: { id: tokenId, userId } });
    if (!existing) return null;
    if (existing.revokedAt) return toPublicToken(existing);

    const row = await db.userApiToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), updatedAt: new Date() }
    });

    return toPublicToken(row);
  }

  // Validate PAT hashes and refresh usage metadata. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
  async verifyToken(token: string, options?: { ip?: string }): Promise<PatVerifyResult | null> {
    if (!token.startsWith(PAT_PREFIX)) return null;
    const tokenHash = hashToken(token);
    const row = await db.userApiToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

    const scopes = normalizePatScopeMap(row.scopes);
    const auth: PatAuthContext = {
      tokenType: 'pat',
      sub: String(row.userId),
      iat: Math.floor(row.createdAt.getTime() / 1000),
      exp: row.expiresAt ? Math.floor(row.expiresAt.getTime() / 1000) : undefined,
      scopes,
      patId: String(row.id)
    };

    const ip = options?.ip ? String(options.ip) : '';
    const shouldTouch =
      !row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() >= PAT_USAGE_TOUCH_COOLDOWN_MS || (ip && ip !== row.lastUsedIp);

    if (shouldTouch) {
      await db.userApiToken.update({
        where: { id: row.id },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: ip || row.lastUsedIp || null,
          updatedAt: new Date()
        }
      });
    }

    return { auth, userId: String(row.userId) };
  }
}
