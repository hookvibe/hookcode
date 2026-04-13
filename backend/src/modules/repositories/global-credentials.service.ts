import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import {
  normalizeUserModelCredentials,
  toPublicUserModelCredentials,
  type UpdateUserModelCredentialsInput,
  type UserModelCredentials,
  type UserModelProviderCredentialProfile,
  type UserModelProviderCredentials,
  type UserRepoProviderCredentialProfile,
  type UserRepoProviderCredentials,
  type UserModelCredentialsPublic
} from '../users/user.service';
import { normalizeHttpBaseUrl } from '../../utils/url';

const GLOBAL_CREDENTIAL_SETTINGS_ID = 'global';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asTrimmedString = (value: unknown): string =>
  (typeof value === 'string' ? value : '').trim();

const toStoredCredentialPayload = (credentials: UserModelCredentials): {
  modelProviderCredentials: Record<string, unknown>;
  repoProviderCredentials: Record<string, unknown>;
} => ({
  // Keep admin-managed provider credentials aligned with the existing user/repo profile JSON shapes. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  modelProviderCredentials: {
    codex: credentials.codex ?? { profiles: [], defaultProfileId: undefined },
    claude_code: credentials.claude_code ?? { profiles: [], defaultProfileId: undefined },
    gemini_cli: credentials.gemini_cli ?? { profiles: [], defaultProfileId: undefined }
  },
  repoProviderCredentials: {
    gitlab: credentials.gitlab ?? { profiles: [], defaultProfileId: undefined },
    github: credentials.github ?? { profiles: [], defaultProfileId: undefined }
  }
});

@Injectable()
export class GlobalCredentialService {
  private mergeStoredCredentialPayload(row: {
    modelProviderCredentials?: unknown;
    repoProviderCredentials?: unknown;
  } | null): UserModelCredentials {
    const merged = {
      ...(isRecord(row?.modelProviderCredentials) ? row?.modelProviderCredentials : {}),
      ...(isRecord(row?.repoProviderCredentials) ? row?.repoProviderCredentials : {})
    };
    return normalizeUserModelCredentials(merged);
  }

  async getCredentialsRaw(): Promise<UserModelCredentials> {
    const row = await db.globalCredentialSettings.findUnique({
      where: { id: GLOBAL_CREDENTIAL_SETTINGS_ID },
      select: { modelProviderCredentials: true, repoProviderCredentials: true }
    });
    return this.mergeStoredCredentialPayload(row);
  }

  async getCredentialsPublic(): Promise<UserModelCredentialsPublic> {
    return toPublicUserModelCredentials(await this.getCredentialsRaw());
  }

  async replaceCredentials(raw: unknown): Promise<UserModelCredentialsPublic> {
    const normalized = normalizeUserModelCredentials(raw);
    const stored = toStoredCredentialPayload(normalized);
    const now = new Date();
    await db.globalCredentialSettings.upsert({
      where: { id: GLOBAL_CREDENTIAL_SETTINGS_ID },
      create: {
        id: GLOBAL_CREDENTIAL_SETTINGS_ID,
        modelProviderCredentials: stored.modelProviderCredentials as any,
        repoProviderCredentials: stored.repoProviderCredentials as any,
        createdAt: now,
        updatedAt: now
      },
      update: {
        modelProviderCredentials: stored.modelProviderCredentials as any,
        repoProviderCredentials: stored.repoProviderCredentials as any,
        updatedAt: now
      }
    });
    return toPublicUserModelCredentials(normalized);
  }

  async updateCredentials(input: UpdateUserModelCredentialsInput): Promise<UserModelCredentialsPublic> {
    const current = await this.getCredentialsRaw();
    const next: UserModelCredentials = { ...current };

    const applyModelProviderUpdate = (
      currentProvider: UserModelProviderCredentials | undefined,
      update:
        | UpdateUserModelCredentialsInput['codex']
        | UpdateUserModelCredentialsInput['claude_code']
        | UpdateUserModelCredentialsInput['gemini_cli']
    ): UserModelProviderCredentials => {
      if (update === null) return { profiles: [], defaultProfileId: undefined };
      if (update === undefined) return currentProvider ?? { profiles: [], defaultProfileId: undefined };

      const map = new Map<string, UserModelProviderCredentialProfile>();
      (currentProvider?.profiles ?? []).forEach((profile) => {
        if (!profile.id) return;
        map.set(profile.id, { ...profile });
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
        update.defaultProfileId === undefined
          ? (currentProvider?.defaultProfileId ?? undefined)
          : update.defaultProfileId === null
            ? undefined
            : asTrimmedString(update.defaultProfileId);

      const profiles = Array.from(map.values());
      const defaultProfileId =
        requestedDefault && profiles.some((profile) => profile.id === requestedDefault) ? requestedDefault : undefined;

      return { profiles, defaultProfileId };
    };

    const applyRepoProviderUpdate = (
      currentProvider: UserRepoProviderCredentials | undefined,
      update: UpdateUserModelCredentialsInput['gitlab'] | UpdateUserModelCredentialsInput['github']
    ): UserRepoProviderCredentials => {
      if (update === null) return { profiles: [], defaultProfileId: undefined };
      if (update === undefined) return currentProvider ?? { profiles: [], defaultProfileId: undefined };

      const map = new Map<string, UserRepoProviderCredentialProfile>();
      (currentProvider?.profiles ?? []).forEach((profile) => {
        if (!profile.id) return;
        map.set(profile.id, { ...profile });
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
      const defaultProfileId =
        requestedDefault && profiles.some((profile) => profile.id === requestedDefault) ? requestedDefault : undefined;

      return { profiles, defaultProfileId };
    };

    if (input.codex !== undefined) {
      // Reuse the account-style profile patch semantics for admin-managed Codex credentials. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
      next.codex = applyModelProviderUpdate(current.codex, input.codex);
    }
    if (input.claude_code !== undefined) {
      next.claude_code = applyModelProviderUpdate(current.claude_code, input.claude_code);
    }
    if (input.gemini_cli !== undefined) {
      next.gemini_cli = applyModelProviderUpdate(current.gemini_cli, input.gemini_cli);
    }
    if (input.gitlab !== undefined) {
      next.gitlab = applyRepoProviderUpdate(current.gitlab, input.gitlab);
    }
    if (input.github !== undefined) {
      next.github = applyRepoProviderUpdate(current.github, input.github);
    }

    const stored = toStoredCredentialPayload(next);
    const now = new Date();
    await db.globalCredentialSettings.upsert({
      where: { id: GLOBAL_CREDENTIAL_SETTINGS_ID },
      create: {
        id: GLOBAL_CREDENTIAL_SETTINGS_ID,
        modelProviderCredentials: stored.modelProviderCredentials as any,
        repoProviderCredentials: stored.repoProviderCredentials as any,
        createdAt: now,
        updatedAt: now
      },
      update: {
        modelProviderCredentials: stored.modelProviderCredentials as any,
        repoProviderCredentials: stored.repoProviderCredentials as any,
        updatedAt: now
      }
    });

    return toPublicUserModelCredentials(next);
  }
}
