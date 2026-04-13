jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    globalCredentialSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    }
  }
}));

import { db } from '../../db';
import { GlobalCredentialService, GlobalCredentialValidationError } from '../../modules/repositories/global-credentials.service';

const service = new GlobalCredentialService();

describe('global credential service', () => {
  // Verify incremental global credential updates preserve stored secrets across admin edits. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updateCredentials keeps existing model provider apiKey when patch omits apiKey', async () => {
    (db.globalCredentialSettings.findUnique as any).mockResolvedValueOnce({
      modelProviderCredentials: {
        codex: {
          profiles: [{ id: 'c1', remark: 'shared', apiBaseUrl: 'https://old.example', apiKey: 'secret-1' }],
          defaultProfileId: 'c1'
        }
      },
      repoProviderCredentials: {}
    });
    (db.globalCredentialSettings.upsert as any).mockResolvedValueOnce(undefined);

    const next = await service.updateCredentials({
      codex: {
        profiles: [{ id: 'c1', apiBaseUrl: 'https://new.example' }]
      }
    });

    expect(db.globalCredentialSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          modelProviderCredentials: expect.objectContaining({
            codex: {
              profiles: [{ id: 'c1', remark: 'shared', apiBaseUrl: 'https://new.example/', apiKey: 'secret-1' }],
              defaultProfileId: 'c1'
            }
          })
        }),
        update: expect.objectContaining({
          modelProviderCredentials: expect.objectContaining({
            codex: {
              profiles: [{ id: 'c1', remark: 'shared', apiBaseUrl: 'https://new.example/', apiKey: 'secret-1' }],
              defaultProfileId: 'c1'
            }
          }),
          updatedAt: expect.any(Date)
        })
      })
    );

    expect(next).toEqual({
      codex: {
        profiles: [{ id: 'c1', remark: 'shared', apiBaseUrl: 'https://new.example/', hasApiKey: true }],
        defaultProfileId: 'c1'
      },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined },
      gitlab: { profiles: [], defaultProfileId: undefined },
      github: { profiles: [], defaultProfileId: undefined }
    });
  });

  test('updateCredentials keeps existing repo provider token when patch omits token', async () => {
    (db.globalCredentialSettings.findUnique as any).mockResolvedValueOnce({
      modelProviderCredentials: {},
      repoProviderCredentials: {
        github: {
          profiles: [{ id: 'gh-1', remark: 'shared-gh', token: 'ghp_1', cloneUsername: 'oauth2' }],
          defaultProfileId: 'gh-1'
        }
      }
    });
    (db.globalCredentialSettings.upsert as any).mockResolvedValueOnce(undefined);

    const next = await service.updateCredentials({
      github: {
        profiles: [{ id: 'gh-1', cloneUsername: 'x-access-token' }]
      }
    });

    expect(db.globalCredentialSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          repoProviderCredentials: expect.objectContaining({
            github: {
              profiles: [{ id: 'gh-1', remark: 'shared-gh', token: 'ghp_1', cloneUsername: 'x-access-token' }],
              defaultProfileId: 'gh-1'
            }
          }),
          updatedAt: expect.any(Date)
        })
      })
    );

    expect(next).toEqual({
      codex: { profiles: [], defaultProfileId: undefined },
      claude_code: { profiles: [], defaultProfileId: undefined },
      gemini_cli: { profiles: [], defaultProfileId: undefined },
      gitlab: { profiles: [], defaultProfileId: undefined },
      github: {
        profiles: [{ id: 'gh-1', remark: 'shared-gh', hasToken: true, cloneUsername: 'x-access-token' }],
        defaultProfileId: 'gh-1'
      }
    });
  });

  test('updateCredentials rejects model provider patches without a remark using a stable validation code', async () => {
    (db.globalCredentialSettings.findUnique as any).mockResolvedValueOnce({
      modelProviderCredentials: {},
      repoProviderCredentials: {}
    });

    await expect(
      service.updateCredentials({
        codex: {
          profiles: [{ id: 'codex-1', apiKey: 'secret-1', remark: null }]
        }
      })
    ).rejects.toMatchObject<Partial<InstanceType<typeof GlobalCredentialValidationError>>>({
      name: 'CredentialValidationError',
      code: 'GLOBAL_CREDENTIAL_MODEL_PROFILE_REMARK_REQUIRED',
      details: { scope: 'global', provider: 'codex', profileId: 'codex-1' }
    });

    expect(db.globalCredentialSettings.upsert).not.toHaveBeenCalled();
  });

  test('updateCredentials rejects repo provider patches without a remark using a stable validation code', async () => {
    (db.globalCredentialSettings.findUnique as any).mockResolvedValueOnce({
      modelProviderCredentials: {},
      repoProviderCredentials: {}
    });

    await expect(
      service.updateCredentials({
        github: {
          profiles: [{ id: 'github-1', token: 'ghp_1', remark: '' }]
        }
      })
    ).rejects.toMatchObject<Partial<InstanceType<typeof GlobalCredentialValidationError>>>({
      name: 'CredentialValidationError',
      code: 'GLOBAL_CREDENTIAL_REPO_PROFILE_REMARK_REQUIRED',
      details: { scope: 'global', provider: 'github', profileId: 'github-1' }
    });

    expect(db.globalCredentialSettings.upsert).not.toHaveBeenCalled();
  });
});
