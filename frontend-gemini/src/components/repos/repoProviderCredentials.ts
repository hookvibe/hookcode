import type { RepoProvider, RepoScopedCredentialsPublic, UserModelCredentialsPublic } from '../../api';

// Reuse provider credential selection across onboarding and dashboard widgets. kzxac35mxk0fg358i7zs
export type RepoProviderCredentialSource = 'user' | 'repo' | 'anonymous';

export const pickRepoProviderCredentials = (
  provider: RepoProvider,
  source: RepoProviderCredentialSource,
  repoScopedCredentials: RepoScopedCredentialsPublic | null,
  userModelCredentials: UserModelCredentialsPublic | null
) => {
  if (source === 'repo') return repoScopedCredentials?.repoProvider ?? null;
  if (source === 'user') {
    const key = provider === 'github' ? 'github' : 'gitlab';
    return (userModelCredentials as any)?.[key] ?? null;
  }
  return null;
};

