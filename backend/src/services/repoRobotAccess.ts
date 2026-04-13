import type { RepoProvider } from '../types/repository';
import type { UserModelCredentials } from '../modules/users/user.service';
import { pickStoredProfileById } from '../utils/credentialProfiles';

const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// Keep repo-provider credential resolution aligned with mixed-scope robots so callers can explicitly request global profiles. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
export type RepoProviderCredentialSource = 'auto' | 'user' | 'repo' | 'robot' | 'global';
export type GlobalAwareRepoProviderCredentialSource = RepoProviderCredentialSource;

export interface RepoScopedRepoProviderCredentials {
  profiles?: Array<{
    id?: string | null;
    token?: string | null;
    cloneUsername?: string | null;
    remark?: string | null;
  }> | null;
  defaultProfileId?: string | null;
}

const getUserProviderCredentials = (
  provider: RepoProvider,
  userCredentials: UserModelCredentials | null,
  profileId?: string | null
): { token: string; cloneUsername: string } => {
  const creds =
    provider === 'github'
      ? userCredentials?.github ?? null
      : provider === 'gitlab'
        ? userCredentials?.gitlab ?? null
        : null;

  const profiles = Array.isArray((creds as any)?.profiles) ? ((creds as any).profiles as any[]) : [];
  // Keep stored repo-provider profile ids exact so robots fail fast instead of silently swapping tokens after profile deletions. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const selected = pickStoredProfileById({
    profiles,
    requestedProfileId: profileId,
    defaultProfileId: (creds as any)?.defaultProfileId
  });

  const token = asTrimmedString(selected?.token);
  const cloneUsername = asTrimmedString(selected?.cloneUsername);
  return { token, cloneUsername };
};

export const inferRobotRepoProviderCredentialSource = (robot: {
  token?: string | null;
  repoCredentialSource?: string | null;
  repoCredentialProfileId?: string | null;
}): Exclude<GlobalAwareRepoProviderCredentialSource, 'auto'> => {
  // Change record: allow explicit source selection now that both user/repo credentials can have profile ids.
  const explicit = asTrimmedString(robot.repoCredentialSource);
  if (explicit === 'robot' || explicit === 'user' || explicit === 'repo' || explicit === 'global') return explicit;

  const robotToken = asTrimmedString(robot.token);
  if (robotToken) return 'robot';
  const profileId = asTrimmedString(robot.repoCredentialProfileId);
  if (profileId) return 'user';
  return 'repo';
};

const getRepoProviderCredentials = (
  repoCredentials: RepoScopedRepoProviderCredentials | null | undefined,
  profileId?: string | null
): { token: string; cloneUsername: string } => {
  const profiles = Array.isArray((repoCredentials as any)?.profiles) ? ((repoCredentials as any).profiles as any[]) : [];
  // Apply the same exact-profile behavior to repo-scoped tokens so explicit selections never drift to a different stored profile. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const selected = pickStoredProfileById({
    profiles,
    requestedProfileId: profileId,
    defaultProfileId: (repoCredentials as any)?.defaultProfileId
  });

  const token = asTrimmedString(selected?.token);
  const cloneUsername = asTrimmedString(selected?.cloneUsername);
  return { token, cloneUsername };
};

const getGlobalProviderCredentials = (
  provider: RepoProvider,
  globalCredentials: UserModelCredentials | null | undefined,
  profileId?: string | null
): { token: string; cloneUsername: string } => {
  const creds =
    provider === 'github'
      ? globalCredentials?.github ?? null
      : provider === 'gitlab'
        ? globalCredentials?.gitlab ?? null
        : null;

  const profiles = Array.isArray((creds as any)?.profiles) ? ((creds as any).profiles as any[]) : [];
  // Keep explicit global profile ids exact so shared robots do not silently switch to another admin-managed credential. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const selected = pickStoredProfileById({
    profiles,
    requestedProfileId: profileId,
    defaultProfileId: (creds as any)?.defaultProfileId
  });
  return {
    token: asTrimmedString(selected?.token),
    cloneUsername: asTrimmedString(selected?.cloneUsername)
  };
};

export const resolveRobotProviderToken = (params: {
  provider: RepoProvider;
  robot: { token?: string | null; repoCredentialSource?: string | null; repoCredentialProfileId?: string | null };
  userCredentials: UserModelCredentials | null;
  globalCredentials?: UserModelCredentials | null;
  repoCredentials?: RepoScopedRepoProviderCredentials | null;
  source?: GlobalAwareRepoProviderCredentialSource;
}): string => {
  const source: GlobalAwareRepoProviderCredentialSource = params.source ?? 'auto';

  const robotToken = asTrimmedString(params.robot.token);
  const globalToken = getGlobalProviderCredentials(params.provider, params.globalCredentials, params.robot.repoCredentialProfileId).token;
  const userToken = getUserProviderCredentials(params.provider, params.userCredentials, params.robot.repoCredentialProfileId).token;
  const repoToken = getRepoProviderCredentials(params.repoCredentials, params.robot.repoCredentialProfileId).token;

  if (source === 'robot') return robotToken;
  if (source === 'global') return globalToken;
  if (source === 'user') return userToken;
  if (source === 'repo') return repoToken;

  if (robotToken) return robotToken;
  if (globalToken) return globalToken;
  if (userToken) return userToken;
  if (repoToken) return repoToken;
  return '';
};

export const resolveRobotCloneUsername = (params: {
  provider: RepoProvider;
  robot: { cloneUsername?: string | null; repoCredentialSource?: string | null; repoCredentialProfileId?: string | null };
  userCredentials: UserModelCredentials | null;
  globalCredentials?: UserModelCredentials | null;
  repoCredentials?: RepoScopedRepoProviderCredentials | null;
  source?: GlobalAwareRepoProviderCredentialSource;
}): string => {
  const source: GlobalAwareRepoProviderCredentialSource = params.source ?? 'auto';

  const robotCloneUsername = asTrimmedString(params.robot.cloneUsername);
  if (robotCloneUsername) return robotCloneUsername;

  const globalCloneUsername = getGlobalProviderCredentials(
    params.provider,
    params.globalCredentials,
    params.robot.repoCredentialProfileId
  ).cloneUsername;
  const userCloneUsername = getUserProviderCredentials(
    params.provider,
    params.userCredentials,
    params.robot.repoCredentialProfileId
  ).cloneUsername;
  const repoCloneUsername = getRepoProviderCredentials(params.repoCredentials, params.robot.repoCredentialProfileId).cloneUsername;

  if (source === 'global') return globalCloneUsername;
  if (source === 'user') return userCloneUsername;
  if (source === 'repo') return repoCloneUsername;
  if (source === 'robot') return '';

  return globalCloneUsername || userCloneUsername || repoCloneUsername;
};

export const getGitCloneAuth = (params: {
  provider: RepoProvider;
  robot: { token?: string | null; cloneUsername?: string | null; repoCredentialSource?: string | null; repoCredentialProfileId?: string | null };
  userCredentials: UserModelCredentials | null;
  globalCredentials?: UserModelCredentials | null;
  repoCredentials?: RepoScopedRepoProviderCredentials | null;
  source?: GlobalAwareRepoProviderCredentialSource;
}): { username: string; password: string } | undefined => {
  const token = resolveRobotProviderToken({
    provider: params.provider,
    robot: params.robot,
    userCredentials: params.userCredentials,
    globalCredentials: params.globalCredentials,
    repoCredentials: params.repoCredentials,
    source: params.source
  });
  if (!token) return undefined;

  const defaultUsername =
    params.provider === 'github'
      ? 'x-access-token'
      : 'oauth2';

  const resolvedUsername =
    asTrimmedString(params.robot.cloneUsername) ||
    resolveRobotCloneUsername({
      provider: params.provider,
      robot: params.robot,
      userCredentials: params.userCredentials,
      globalCredentials: params.globalCredentials,
      repoCredentials: params.repoCredentials,
      source: params.source
    }) ||
    defaultUsername;

  return { username: resolvedUsername, password: token };
};
