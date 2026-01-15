import {
  getGitCloneAuth,
  inferRobotRepoProviderCredentialSource,
  resolveRobotCloneUsername,
  resolveRobotProviderToken
} from '../../services/repoRobotAccess';

describe('repoRobotAccess', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('resolveRobotProviderToken prefers robot token over user token', () => {
    const token = resolveRobotProviderToken({
      provider: 'github',
      robot: { token: 'robot-1' },
      userCredentials: { github: { profiles: [{ id: 'gh-1', remark: 'main', token: 'user-1' }], defaultProfileId: 'gh-1' } }
    });
    expect(token).toBe('robot-1');
  });

  test('resolveRobotProviderToken falls back to user token when robot token is empty', () => {
    const token = resolveRobotProviderToken({
      provider: 'gitlab',
      robot: { token: '' },
      userCredentials: { gitlab: { profiles: [{ id: 'gl-1', remark: 'main', token: 'user-1' }], defaultProfileId: 'gl-1' } }
    });
    expect(token).toBe('user-1');
  });

  test('resolveRobotProviderToken selects the requested user profile when repoCredentialProfileId is set', () => {
    const token = resolveRobotProviderToken({
      provider: 'github',
      robot: { token: null, repoCredentialProfileId: 'gh-2' },
      userCredentials: {
        github: {
          profiles: [
            { id: 'gh-1', remark: 'org-a', token: 't1' },
            { id: 'gh-2', remark: 'org-b', token: 't2' }
          ],
          defaultProfileId: 'gh-1'
        }
      }
    });
    expect(token).toBe('t2');
  });

  test('resolveRobotProviderToken does not use env fallback tokens', () => {
    const token = resolveRobotProviderToken({
      provider: 'gitlab',
      robot: {},
      userCredentials: null
    });
    expect(token).toBe('');
  });

  test('resolveRobotCloneUsername prefers robot cloneUsername over user cloneUsername', () => {
    const cloneUsername = resolveRobotCloneUsername({
      provider: 'github',
      robot: { cloneUsername: 'robot-user' },
      userCredentials: {
        github: {
          profiles: [{ id: 'gh-1', remark: 'main', token: 't1', cloneUsername: 'user-user' }],
          defaultProfileId: 'gh-1'
        }
      }
    });
    expect(cloneUsername).toBe('robot-user');
  });

  test('resolveRobotCloneUsername falls back to user cloneUsername when robot cloneUsername is empty', () => {
    const cloneUsername = resolveRobotCloneUsername({
      provider: 'github',
      robot: { cloneUsername: '' },
      userCredentials: {
        github: {
          profiles: [{ id: 'gh-1', remark: 'main', token: 't1', cloneUsername: 'user-user' }],
          defaultProfileId: 'gh-1'
        }
      }
    });
    expect(cloneUsername).toBe('user-user');
  });

  test('getGitCloneAuth uses provider defaults for username', () => {
    const auth = getGitCloneAuth({
      provider: 'github',
      robot: {},
      userCredentials: { github: { profiles: [{ id: 'gh-1', remark: 'main', token: 'ghp_1' }], defaultProfileId: 'gh-1' } }
    });
    expect(auth).toEqual({ username: 'x-access-token', password: 'ghp_1' });
  });

  test('getGitCloneAuth uses repo token and cloneUsername from user', () => {
    const auth = getGitCloneAuth({
      provider: 'gitlab',
      robot: {},
      userCredentials: { gitlab: { profiles: [{ id: 'gl-1', remark: 'main', cloneUsername: 'oauth2' }], defaultProfileId: 'gl-1' } },
      repoCredentials: { profiles: [{ id: 'r-1', remark: 'repo', token: 'glpat_1' }], defaultProfileId: 'r-1' }
    });
    expect(auth).toEqual({ username: 'oauth2', password: 'glpat_1' });
  });

  test('getGitCloneAuth returns undefined when no token can be resolved', () => {
    const auth = getGitCloneAuth({ provider: 'github', robot: {}, userCredentials: null });
    expect(auth).toBeUndefined();
  });

  test('resolveRobotProviderToken supports repo-scoped credentials when source=repo', () => {
    const token = resolveRobotProviderToken({
      provider: 'gitlab',
      robot: {},
      userCredentials: null,
      repoCredentials: { profiles: [{ id: 'r-1', remark: 'repo', token: 'repo-1' }], defaultProfileId: 'r-1' },
      source: 'repo'
    });
    expect(token).toBe('repo-1');
  });

  test('resolveRobotProviderToken does not fall back to env when source=repo', () => {
    process.env.GITHUB_TOKEN = 'env-1';
    const token = resolveRobotProviderToken({
      provider: 'github',
      robot: {},
      userCredentials: null,
      repoCredentials: { profiles: [{ id: 'r-1', remark: 'repo', token: '' }], defaultProfileId: 'r-1' },
      source: 'repo'
    });
    expect(token).toBe('');
  });

  test('getGitCloneAuth prefers repo-scoped cloneUsername when source=repo', () => {
    const auth = getGitCloneAuth({
      provider: 'gitlab',
      robot: {},
      userCredentials: null,
      repoCredentials: { profiles: [{ id: 'r-1', remark: 'repo', token: 'glpat_1', cloneUsername: 'oauth2' }], defaultProfileId: 'r-1' },
      source: 'repo'
    });
    expect(auth).toEqual({ username: 'oauth2', password: 'glpat_1' });
  });

  test('inferRobotRepoProviderCredentialSource infers repo when robot/user are empty', () => {
    const source = inferRobotRepoProviderCredentialSource({ token: null, repoCredentialProfileId: null });
    expect(source).toBe('repo');
  });
});
