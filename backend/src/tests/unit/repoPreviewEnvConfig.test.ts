export {};

jest.mock('../../db', () => ({
  db: {
    repository: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe('Repository preview env config', () => {
  test('getRepoPreviewEnvConfig redacts secret values', async () => {
    // Verify preview env config redaction for repo settings API. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    const { db } = await import('../../db');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const repositoryService = new RepositoryService();

    (db.repository.findUnique as jest.Mock).mockResolvedValueOnce({
      previewEnv: {
        variables: [
          { key: 'API_URL', value: 'http://example.com/api', secret: false },
          { key: 'DB_URL', value: 'postgres://secret', secret: true }
        ]
      }
    });

    const result = await repositoryService.getRepoPreviewEnvConfig('r1');
    expect(result?.public).toEqual({
      variables: [
        { key: 'API_URL', isSecret: true, hasValue: true },
        { key: 'DB_URL', isSecret: true, hasValue: true }
      ]
    });
  });

  test('updateRepository preserves secret preview env values when omitted', async () => {
    // Ensure secret preview env values persist when patches omit the value. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
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
        repoProviderCredentials: { profiles: [], defaultProfileId: null },
        modelProviderCredentials: { codex: { profiles: [], defaultProfileId: null } }
      })
      // getRepoPreviewEnvConfig()
      .mockResolvedValueOnce({
        previewEnv: {
          variables: [{ key: 'DB_URL', value: 'postgres://secret', secret: true }]
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
      previewEnvConfig: { entries: [{ key: 'DB_URL', secret: true }] }
    });

    expect(db.repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previewEnv: {
            variables: [{ key: 'DB_URL', value: 'postgres://secret', secret: true }]
          }
        })
      })
    );
  });

  test('updateRepository rejects reserved preview env keys', async () => {
    // Guard against reserved env keys in preview env patches. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
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
        repoProviderCredentials: { profiles: [], defaultProfileId: null },
        modelProviderCredentials: { codex: { profiles: [], defaultProfileId: null } }
      })
      // getRepoPreviewEnvConfig()
      .mockResolvedValueOnce({ previewEnv: { variables: [] } });

    await expect(
      repositoryService.updateRepository('r1', {
        previewEnvConfig: { entries: [{ key: 'PORT', value: '1234' }] }
      })
    ).rejects.toThrow('repo env key "PORT" is reserved');
  });

  test('updateRepository ignores reserved keys in removeKeys', async () => {
    // Ignore reserved removeKeys to keep deletion calls idempotent. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
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
        repoProviderCredentials: { profiles: [], defaultProfileId: null },
        modelProviderCredentials: { codex: { profiles: [], defaultProfileId: null } }
      })
      // getRepoPreviewEnvConfig()
      .mockResolvedValueOnce({ previewEnv: { variables: [{ key: 'DB_URL', value: 'postgres://secret', secret: true }] } });

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

    await expect(
      repositoryService.updateRepository('r1', {
        previewEnvConfig: { removeKeys: ['PORT'] }
      })
    ).resolves.toEqual(
      expect.objectContaining({
        repo: expect.objectContaining({ id: 'r1' })
      })
    );
  });
});
