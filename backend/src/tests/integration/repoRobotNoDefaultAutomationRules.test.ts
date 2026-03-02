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
    // Provide repo controller dependency stubs for integration tests. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) };
    const repoMemberService = {} as any;
    const repoRobotService = new RepoRobotService();
    const repoAutomationService = new RepoAutomationService();
    const repoWebhookDeliveryService = new RepoWebhookDeliveryService();
    const previewService = {} as any;
    const skillsService = {} as any;
    const logWriter = { logOperation: jest.fn(), logSystem: jest.fn(), logExecution: jest.fn() }; // Provide LogWriterService stub for integration coverage. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    const repositoriesController = new RepositoriesController(
      repositoryService,
      repoAccessService as any,
      repoMemberService,
      repoRobotService,
      repoAutomationService,
      repoWebhookDeliveryService,
      userService,
      previewService,
      skillsService,
      logWriter
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
