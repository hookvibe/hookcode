export {};

const dbUrl = String(process.env.DATABASE_URL_TEST || '').trim();
const describeDb = dbUrl ? describe : describe.skip;

const truncateAll = async () => {
  const { db } = await import('../../db');
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      email_verification_tokens,
      repo_automation_configs,
      repo_robots,
      repositories,
      users,
      tasks
    CASCADE;
  `);
};

describeDb('Robot pending activation + token test enablement', () => {
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.DATABASE_URL = dbUrl;
    const { ensureSchema } = await import('../../db');
    await ensureSchema();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    const { closeDb } = await import('../../db');
    await closeDb();
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  test('new robot defaults to disabled and becomes enabled after a successful activation test', async () => {
    const { UserService } = await import('../../modules/users/user.service');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const { RepoRobotService } = await import('../../modules/repositories/repo-robot.service');
    const { RepoAutomationService } = await import('../../modules/repositories/repo-automation.service');
    const { RepoWebhookDeliveryService } = await import('../../modules/repositories/repo-webhook-delivery.service');
    const { RepositoriesController } = await import('../../modules/repositories/repositories.controller');

    const userService = new UserService();
    const repositoryService = new RepositoryService();
    const repoRobotService = new RepoRobotService();
    const repoAutomationService = new RepoAutomationService();
    const repoWebhookDeliveryService = new RepoWebhookDeliveryService();
    const repositoriesController = new RepositoriesController(
      repositoryService,
      repoRobotService,
      repoAutomationService,
      repoWebhookDeliveryService,
      userService
    );

    const owner = await userService.createUser({ username: 'owner-activate-1', password: 'pass123' });
    const created = await repositoryService.createRepository(
      { id: owner.id },
      { provider: 'gitlab', name: 'repo-activate-1', externalId: '123', apiBaseUrl: 'https://gitlab.example.com' }
    );
    await repositoryService.markWebhookVerified(created.repo.id);
    const robot = await repoRobotService.createRobot({ id: owner.id }, created.repo.id, {
      name: 'hookcode-review',
      token: 'tok',
      promptDefault: 'PROMPT',
      isDefault: true
    });
    expect(robot.enabled).toBe(false);
    expect(robot.activatedAt).toBeUndefined();

    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/v4/projects/123/members/all/')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ id: 32667442, username: 'alice', name: 'Alice', access_level: 30, state: 'active', expires_at: null }),
          text: async () => ''
        };
      }
      if (u.endsWith('/api/v4/user')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ id: 32667442, username: 'alice', name: 'Alice', email: 'alice@example.com' }),
          text: async () => ''
        };
      }
      if (u.includes('/api/v4/projects/123')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ id: 123, name: 'repo', path_with_namespace: 'group/repo', web_url: 'https://gitlab.example.com/group/repo' }),
          text: async () => ''
        };
      }
      throw new Error(`unexpected url: ${u}`);
    });

    const req = {
      user: { id: owner.id, username: owner.username, roles: [] },
      params: { id: created.repo.id, robotId: robot.id }
    } as any;

    const result = await repositoriesController.testRobot(created.repo.id, robot.id, req);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        robot: expect.objectContaining({
          id: robot.id,
          enabled: true,
          activatedAt: expect.any(String),
          lastTestOk: true,
          repoTokenUserEmail: 'alice@example.com',
          repoTokenRepoRole: 'developer'
        })
      })
    );

    const updated = await repoRobotService.getById(robot.id);
    expect(updated?.enabled).toBe(true);
    expect(updated?.activatedAt).toBeTruthy();
  });

  test('failed activation test keeps robot disabled and writes lastTest fields', async () => {
    const { UserService } = await import('../../modules/users/user.service');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const { RepoRobotService } = await import('../../modules/repositories/repo-robot.service');
    const { RepoAutomationService } = await import('../../modules/repositories/repo-automation.service');
    const { RepoWebhookDeliveryService } = await import('../../modules/repositories/repo-webhook-delivery.service');
    const { RepositoriesController } = await import('../../modules/repositories/repositories.controller');

    const userService = new UserService();
    const repositoryService = new RepositoryService();
    const repoRobotService = new RepoRobotService();
    const repoAutomationService = new RepoAutomationService();
    const repoWebhookDeliveryService = new RepoWebhookDeliveryService();
    const repositoriesController = new RepositoriesController(
      repositoryService,
      repoRobotService,
      repoAutomationService,
      repoWebhookDeliveryService,
      userService
    );

    const owner = await userService.createUser({ username: 'owner-activate-2', password: 'pass123' });
    const created = await repositoryService.createRepository(
      { id: owner.id },
      { provider: 'github', name: 'repo-activate-2', externalId: 'acme/test', apiBaseUrl: 'https://api.github.com' }
    );
    await repositoryService.markWebhookVerified(created.repo.id);
    const robot = await repoRobotService.createRobot({ id: owner.id }, created.repo.id, {
      name: 'hookcode-review',
      token: 'bad-token',
      promptDefault: 'PROMPT',
      isDefault: true
    });

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Bad credentials' }),
      text: async () => 'Bad credentials'
    });

    const req = {
      user: { id: owner.id, username: owner.username, roles: [] },
      params: { id: created.repo.id, robotId: robot.id }
    } as any;

    const result = await repositoriesController.testRobot(created.repo.id, robot.id, req);

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        robot: expect.objectContaining({
          id: robot.id,
          enabled: false,
          lastTestOk: false,
          lastTestAt: expect.any(String)
        })
      })
    );
  });
});
