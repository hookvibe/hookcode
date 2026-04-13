import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { CLAUDE_CODE_PROVIDER_KEY } from '../../modelProviders/claudeCode';
import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { GEMINI_CLI_PROVIDER_KEY } from '../../modelProviders/geminiCli';
import { getLocalProviderAuthStatus, resolveProviderExecutionCredential } from '../../modelProviders/providerCredentialResolver';

describe('providerCredentialResolver', () => {
  const originalEnv = { ...process.env };
  afterEach(async () => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test('prefers local Claude environment auth over stored robot/repo/user credentials', async () => {
    // Keep local-first precedence explicit so ClaudeCodeUI-style auth wins before stored overrides. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
    process.env.ANTHROPIC_API_KEY = 'sk-local-claude';

    const resolved = await resolveProviderExecutionCredential({
      provider: CLAUDE_CODE_PROVIDER_KEY,
      robotConfigRaw: {
        credentialSource: 'robot',
        credential: { apiKey: 'sk-robot-claude', apiBaseUrl: 'https://robot.example.com' }
      },
      userCredentials: {
        claude_code: {
          profiles: [{ id: 'user-1', remark: 'user', apiKey: 'sk-user-claude', apiBaseUrl: 'https://user.example.com' }],
          defaultProfileId: 'user-1'
        }
      } as any,
      repoScopedCredentials: {
        claude_code: {
          profiles: [{ id: 'repo-1', remark: 'repo', apiKey: 'sk-repo-claude', apiBaseUrl: 'https://repo.example.com' }],
          defaultProfileId: 'repo-1'
        }
      } as any
    });

    expect(resolved.resolvedLayer).toBe('local');
    expect(resolved.resolvedMethod).toBe('env_api_key');
    expect(resolved.apiKey).toBe('sk-local-claude');
    expect(resolved.fallbackUsed).toBe(false);
  });

  test('uses repo-scoped profile as the default stored source when repo model discovery omits robot config', async () => {
    const fakeHome = await mkdtemp(path.join(os.tmpdir(), 'hookcode-provider-home-'));
    jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);

    const resolved = await resolveProviderExecutionCredential({
      provider: CODEX_PROVIDER_KEY,
      userCredentials: {
        codex: {
          profiles: [{ id: 'user-1', remark: 'user', apiKey: 'sk-user-codex' }],
          defaultProfileId: 'user-1'
        }
      } as any,
      repoScopedCredentials: {
        codex: {
          profiles: [{ id: 'repo-1', remark: 'repo', apiKey: 'sk-repo-codex' }],
          defaultProfileId: 'repo-1'
        }
      } as any,
      defaultStoredSource: 'repo'
    });

    expect(resolved.requestedStoredSource).toBe('repo');
    expect(resolved.resolvedLayer).toBe('repo');
    expect(resolved.apiKey).toBe('sk-repo-codex');
    await rm(fakeHome, { recursive: true, force: true });
  });

  test('uses repo-scoped profile when requested and local auth is unavailable', async () => {
    delete process.env.OPENAI_API_KEY;
    const fakeHome = await mkdtemp(path.join(os.tmpdir(), 'hookcode-provider-home-'));
    jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);

    const resolved = await resolveProviderExecutionCredential({
      provider: CODEX_PROVIDER_KEY,
      robotConfigRaw: {
        credentialSource: 'repo',
        credentialProfileId: 'repo-1'
      },
      userCredentials: {
        codex: {
          profiles: [{ id: 'user-1', remark: 'user', apiKey: 'sk-user-codex' }],
          defaultProfileId: 'user-1'
        }
      } as any,
      repoScopedCredentials: {
        codex: {
          profiles: [{ id: 'repo-1', remark: 'repo', apiKey: 'sk-repo-codex', apiBaseUrl: 'https://repo.example.com' }],
          defaultProfileId: 'repo-1'
        }
      } as any
    });

    expect(resolved.resolvedLayer).toBe('repo');
    expect(resolved.resolvedMethod).toBe('repo_profile');
    expect(resolved.profileId).toBe('repo-1');
    expect(resolved.apiKey).toBe('sk-repo-codex');
    await rm(fakeHome, { recursive: true, force: true });
  });

  test('falls back from missing repo profile to user profile', async () => {
    const fakeHome = await mkdtemp(path.join(os.tmpdir(), 'hookcode-provider-home-'));
    jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);

    const resolved = await resolveProviderExecutionCredential({
      provider: CODEX_PROVIDER_KEY,
      robotConfigRaw: {
        credentialSource: 'repo',
        credentialProfileId: 'missing-repo-profile'
      },
      userCredentials: {
        codex: {
          profiles: [{ id: 'user-1', remark: 'user', apiKey: 'sk-user-codex' }],
          defaultProfileId: 'user-1'
        }
      } as any,
      repoScopedCredentials: {
        codex: {
          profiles: [],
          defaultProfileId: undefined
        }
      } as any
    });

    expect(resolved.resolvedLayer).toBe('user');
    expect(resolved.resolvedMethod).toBe('user_profile');
    expect(resolved.profileId).toBe('user-1');
    expect(resolved.fallbackUsed).toBe(true);
    await rm(fakeHome, { recursive: true, force: true });
  });

  // Preserve cross-layer fallback while preventing explicit global profile ids from silently selecting a different shared API key. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  test('falls back to the user profile instead of silently switching to a different global profile when the explicit global profile id is missing', async () => {
    const fakeHome = await mkdtemp(path.join(os.tmpdir(), 'hookcode-provider-home-'));
    jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);

    const resolved = await resolveProviderExecutionCredential({
      provider: CODEX_PROVIDER_KEY,
      robotConfigRaw: {
        credentialSource: 'global',
        credentialProfileId: 'missing-global-profile'
      },
      globalCredentials: {
        codex: {
          profiles: [{ id: 'global-default', remark: 'global', apiKey: 'sk-global-codex' }],
          defaultProfileId: 'global-default'
        }
      } as any,
      userCredentials: {
        codex: {
          profiles: [{ id: 'user-1', remark: 'user', apiKey: 'sk-user-codex' }],
          defaultProfileId: 'user-1'
        }
      } as any
    });

    expect(resolved.requestedStoredSource).toBe('global');
    expect(resolved.resolvedLayer).toBe('user');
    expect(resolved.resolvedMethod).toBe('user_profile');
    expect(resolved.profileId).toBe('user-1');
    expect(resolved.fallbackUsed).toBe(true);
    await rm(fakeHome, { recursive: true, force: true });
  });

  test('detects local Gemini OAuth auth from the copied home directory source', async () => {
    const fakeHome = await mkdtemp(path.join(os.tmpdir(), 'hookcode-provider-home-'));
    try {
      const geminiDir = path.join(fakeHome, '.gemini');
      await mkdir(geminiDir, { recursive: true });
      await writeFile(path.join(geminiDir, 'oauth_creds.json'), JSON.stringify({ access_token: 'token-123' }), 'utf8');
      await writeFile(path.join(geminiDir, 'google_accounts.json'), JSON.stringify({ active: 'gemini@example.com' }), 'utf8');
      jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);

      const status = await getLocalProviderAuthStatus(GEMINI_CLI_PROVIDER_KEY);
      expect(status.authenticated).toBe(true);
      expect(status.method).toBe('oauth_creds');
      expect(status.displayName).toBe('gemini@example.com');
      expect(status.hasApiKey).toBe(false);
    } finally {
      await rm(fakeHome, { recursive: true, force: true });
    }
  });
});
