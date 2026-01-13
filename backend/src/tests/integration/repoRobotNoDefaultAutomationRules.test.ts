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

describeDb('Robot creation does not auto-generate automation rules', () => {
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

  test('keeps issue rules empty after creating a robot', async () => {
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

    const owner = await userService.createUser({
      username: 'owner-robot-default-rule',
      password: 'pass123'
    });
    const created = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'repo-1' });
    await repositoryService.markWebhookVerified(created.repo.id);

    const req = {
      user: { id: owner.id, username: owner.username, roles: [] },
      params: { id: created.repo.id },
      body: {
        name: 'hookcode-review',
        promptDefault: 'PROMPT',
        isDefault: true
      }
    } as any;
    await repositoriesController.createRobot(created.repo.id, req, req.body);

    const config = await repoAutomationService.getConfig(created.repo.id);
    expect(config.events.issue?.rules ?? []).toHaveLength(0);
  });
});
