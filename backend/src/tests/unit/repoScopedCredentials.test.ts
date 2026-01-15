export {};

jest.mock('../../db', () => ({
  db: {
    repository: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe('Repository repo-scoped credentials', () => {
  test('getRepoScopedCredentials returns normalized + public redacted shape', async () => {
    const { db } = await import('../../db');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const repositoryService = new RepositoryService();

    (db.repository.findUnique as jest.Mock).mockResolvedValue({
      repoProviderCredentials: {
        profiles: [{ id: 'rp-1', remark: 'main', token: 'tok', cloneUsername: 'oauth2' }],
        defaultProfileId: 'rp-1'
      },
      modelProviderCredentials: {
        codex: {
          profiles: [{ id: 'mp-1', remark: 'main', apiBaseUrl: 'https://api.example.com', apiKey: 'k' }],
          defaultProfileId: 'mp-1'
        }
      }
    });

    const result = await repositoryService.getRepoScopedCredentials('r1');
    expect(result).toEqual(
      expect.objectContaining({
        repoProvider: {
          profiles: [{ id: 'rp-1', remark: 'main', token: 'tok', cloneUsername: 'oauth2' }],
          defaultProfileId: 'rp-1'
        },
        modelProvider: expect.objectContaining({
          codex: {
            profiles: [{ id: 'mp-1', remark: 'main', apiBaseUrl: 'https://api.example.com/', apiKey: 'k' }],
            defaultProfileId: 'mp-1'
          }
        }),
        public: {
          repoProvider: {
            profiles: [{ id: 'rp-1', remark: 'main', hasToken: true, cloneUsername: 'oauth2' }],
            defaultProfileId: 'rp-1'
          },
          modelProvider: {
            codex: {
              profiles: [{ id: 'mp-1', remark: 'main', apiBaseUrl: 'https://api.example.com/', hasApiKey: true }],
              defaultProfileId: 'mp-1'
            },
            claude_code: { profiles: [], defaultProfileId: undefined },
            gemini_cli: { profiles: [], defaultProfileId: undefined }
          }
        }
      })
    );
  });

  test('updateRepository merges repo-scoped credentials without losing existing secrets', async () => {
    const { db } = await import('../../db');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const repositoryService = new RepositoryService();

    (db.repository.findUnique as jest.Mock)
      // getByIdWithSecret()
      .mockResolvedValueOnce({
        id: 'r1',
        provider: 'gitlab',
        name: 'group/project',
        externalId: '123',
        apiBaseUrl: 'https://gitlab.example.com',
        branches: null,
        webhookSecret: 's3cr3t',
        webhookVerifiedAt: null,
        visibility: 'private',
        basicInfoVisibility: 'public',
        robotConfigVisibility: 'public',
        triggerVisibility: 'public',
        enabled: true,
        createdBy: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdByUser: null
      })
      // getRepoScopedCredentials()
      .mockResolvedValueOnce({
        repoProviderCredentials: {
          profiles: [{ id: 'rp-1', remark: 'main', token: 'oldTok', cloneUsername: 'oauth2' }],
          defaultProfileId: 'rp-1'
        },
        modelProviderCredentials: {
          codex: {
            profiles: [{ id: 'mp-1', remark: 'main', apiBaseUrl: 'https://old.example.com', apiKey: 'oldKey' }],
            defaultProfileId: 'mp-1'
          }
        }
      });

    (db.repository.update as jest.Mock).mockResolvedValue({
      id: 'r1',
      provider: 'gitlab',
      name: 'group/project',
      externalId: '123',
      apiBaseUrl: 'https://gitlab.example.com',
      branches: null,
      webhookSecret: 's3cr3t',
      webhookVerifiedAt: null,
      visibility: 'private',
      basicInfoVisibility: 'public',
      robotConfigVisibility: 'public',
      triggerVisibility: 'public',
      enabled: true,
      createdBy: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdByUser: null
    });

    await repositoryService.updateRepository('r1', {
      repoProviderCredential: { profiles: [{ id: 'rp-1', cloneUsername: 'alice' }] },
      modelProviderCredential: { codex: { profiles: [{ id: 'mp-1', apiBaseUrl: 'https://new.example.com' }] } }
    });

    expect(db.repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          repoProviderCredentials: {
            profiles: [{ id: 'rp-1', remark: 'main', token: 'oldTok', cloneUsername: 'alice' }],
            defaultProfileId: 'rp-1'
          },
          modelProviderCredentials: {
            codex: {
              profiles: [{ id: 'mp-1', remark: 'main', apiKey: 'oldKey', apiBaseUrl: 'https://new.example.com/' }],
              defaultProfileId: 'mp-1'
            }
          }
        })
      })
    );
  });
});
