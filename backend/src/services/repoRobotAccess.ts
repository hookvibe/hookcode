import type { RepoProvider } from '../types/repository';
import type { UserModelCredentials } from '../modules/users/user.service';

const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export type RepoProviderCredentialSource = 'auto' | 'user' | 'repo' | 'robot';

export interface RepoScopedRepoProviderCredential {
  token?: string | null;
  cloneUsername?: string | null;
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
  const requestedId = asTrimmedString(profileId);
  const defaultId = asTrimmedString((creds as any)?.defaultProfileId);

  const selected =
    (requestedId && profiles.find((p) => asTrimmedString(p?.id) === requestedId)) ||
    (defaultId && profiles.find((p) => asTrimmedString(p?.id) === defaultId)) ||
    profiles.find((p) => Boolean(p && asTrimmedString(p?.id)));

  const token = asTrimmedString(selected?.token);
  const cloneUsername = asTrimmedString(selected?.cloneUsername);
  return { token, cloneUsername };
};

export const inferRobotRepoProviderCredentialSource = (robot: {
  token?: string | null;
  repoCredentialProfileId?: string | null;
}): Exclude<RepoProviderCredentialSource, 'auto'> => {
  const robotToken = asTrimmedString(robot.token);
  if (robotToken) return 'robot';
  const profileId = asTrimmedString(robot.repoCredentialProfileId);
  if (profileId) return 'user';
  return 'repo';
};

export const resolveRobotProviderToken = (params: {
  provider: RepoProvider;
  robot: { token?: string | null; repoCredentialProfileId?: string | null };
  userCredentials: UserModelCredentials | null;
  repoCredentials?: RepoScopedRepoProviderCredential | null;
  source?: RepoProviderCredentialSource;
}): string => {
  const source: RepoProviderCredentialSource = params.source ?? 'auto';

  const robotToken = asTrimmedString(params.robot.token);
  const userToken = getUserProviderCredentials(params.provider, params.userCredentials, params.robot.repoCredentialProfileId).token;
  const repoToken = asTrimmedString(params.repoCredentials?.token);

  if (source === 'robot') return robotToken;
  if (source === 'user') return userToken;
  if (source === 'repo') return repoToken;

  if (robotToken) return robotToken;
  if (userToken) return userToken;
  if (repoToken) return repoToken;
  return '';
};

export const resolveRobotCloneUsername = (params: {
  provider: RepoProvider;
  robot: { cloneUsername?: string | null; repoCredentialProfileId?: string | null };
  userCredentials: UserModelCredentials | null;
  repoCredentials?: RepoScopedRepoProviderCredential | null;
  source?: RepoProviderCredentialSource;
}): string => {
  const source: RepoProviderCredentialSource = params.source ?? 'auto';

  const robotCloneUsername = asTrimmedString(params.robot.cloneUsername);
  if (robotCloneUsername) return robotCloneUsername;

  const userCloneUsername = getUserProviderCredentials(
    params.provider,
    params.userCredentials,
    params.robot.repoCredentialProfileId
  ).cloneUsername;
  const repoCloneUsername = asTrimmedString(params.repoCredentials?.cloneUsername);

  if (source === 'user') return userCloneUsername;
  if (source === 'repo') return repoCloneUsername;
  if (source === 'robot') return '';

  return userCloneUsername || repoCloneUsername;
};

export const getGitCloneAuth = (params: {
  provider: RepoProvider;
  robot: { token?: string | null; cloneUsername?: string | null; repoCredentialProfileId?: string | null };
  userCredentials: UserModelCredentials | null;
  repoCredentials?: RepoScopedRepoProviderCredential | null;
  source?: RepoProviderCredentialSource;
}): { username: string; password: string } | undefined => {
  const token = resolveRobotProviderToken({
    provider: params.provider,
    robot: params.robot,
    userCredentials: params.userCredentials,
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
      repoCredentials: params.repoCredentials,
      source: params.source
    }) ||
    defaultUsername;

  return { username: resolvedUsername, password: token };
};
