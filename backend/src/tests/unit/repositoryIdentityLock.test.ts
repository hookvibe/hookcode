export {};

jest.mock('../../db', () => ({
  db: {
    repository: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe('Repository identity lock', () => {
  test('locks externalId after webhook verification', async () => {
    const { db } = await import('../../db');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const repositoryService = new RepositoryService();

    (db.repository.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      provider: 'gitlab',
      name: 'group/project',
      externalId: '123',
      apiBaseUrl: 'https://gitlab.example.com',
      branches: null,
      webhookSecret: 's3cr3t',
      webhookVerifiedAt: new Date('2025-12-31T00:00:00.000Z'),
      visibility: 'private',
      basicInfoVisibility: 'public',
      robotConfigVisibility: 'public',
      triggerVisibility: 'public',
      enabled: true,
      createdBy: null,
      createdAt: new Date('2025-12-31T00:00:00.000Z'),
      updatedAt: new Date('2025-12-31T00:00:00.000Z'),
      createdByUser: null
    });

    await expect(repositoryService.updateRepository('r1', { externalId: '456' })).rejects.toThrow(
      'externalId is locked after webhook verification'
    );
    expect(db.repository.update).not.toHaveBeenCalled();
  });

  test('locks apiBaseUrl after webhook verification', async () => {
    const { db } = await import('../../db');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const repositoryService = new RepositoryService();

    (db.repository.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      provider: 'github',
      name: 'octo/repo',
      externalId: 'octo/repo',
      apiBaseUrl: 'https://api.github.com',
      branches: null,
      webhookSecret: 's3cr3t',
      webhookVerifiedAt: new Date('2025-12-31T00:00:00.000Z'),
      visibility: 'private',
      basicInfoVisibility: 'public',
      robotConfigVisibility: 'public',
      triggerVisibility: 'public',
      enabled: true,
      createdBy: null,
      createdAt: new Date('2025-12-31T00:00:00.000Z'),
      updatedAt: new Date('2025-12-31T00:00:00.000Z'),
      createdByUser: null
    });

    await expect(repositoryService.updateRepository('r1', { apiBaseUrl: 'https://ghe.example.com/api/v3' })).rejects.toThrow(
      'apiBaseUrl is locked after webhook verification'
    );
    expect(db.repository.update).not.toHaveBeenCalled();
  });
});
