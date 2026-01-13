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
      repoProviderCredentials: { token: 'tok', cloneUsername: 'oauth2' },
      modelProviderCredentials: { codex: { apiBaseUrl: 'https://api.example.com', apiKey: 'k' } }
    });

    const result = await repositoryService.getRepoScopedCredentials('r1');
    expect(result).toEqual(
      expect.objectContaining({
        repoProvider: { token: 'tok', cloneUsername: 'oauth2' },
        modelProvider: expect.objectContaining({ codex: { apiBaseUrl: 'https://api.example.com', apiKey: 'k' } }),
        public: {
          repoProvider: { hasToken: true, cloneUsername: 'oauth2' },
          modelProvider: {
            codex: { apiBaseUrl: 'https://api.example.com', hasApiKey: true },
            claude_code: { hasApiKey: false },
            gemini_cli: { hasApiKey: false }
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
        repoProviderCredentials: { token: 'oldTok', cloneUsername: 'oauth2' },
        modelProviderCredentials: { codex: { apiBaseUrl: 'https://old.example.com', apiKey: 'oldKey' } }
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
      repoProviderCredential: { cloneUsername: 'alice' },
      modelProviderCredential: { codex: { apiBaseUrl: 'https://new.example.com' } }
    });

    expect(db.repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          repoProviderCredentials: { token: 'oldTok', cloneUsername: 'alice' },
          modelProviderCredentials: { codex: { apiBaseUrl: 'https://new.example.com', apiKey: 'oldKey' } }
        })
      })
    );
  });
});
