export {};

import { HttpException } from '@nestjs/common';

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

describeDb('Robot delete guard (automation rule references)', () => {
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

  test('returns 409 when the robot is referenced by automation rules', async () => {
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
      username: 'owner-delete-guard',
      password: 'pass123'
    });
    const created = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'repo-1' });
    await repositoryService.markWebhookVerified(created.repo.id);
    const robot = await repoRobotService.createRobot({ id: owner.id }, created.repo.id, {
      name: 'hookcode-review',
      promptDefault: 'PROMPT',
      isDefault: true
    });

    await repoAutomationService.updateConfig(created.repo.id, {
      version: 2,
      events: {
        issue: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'rule 1',
              enabled: true,
              match: { all: [{ field: 'event.subType', op: 'in', values: ['created'] }] },
              actions: [{ id: 'act-1', robotId: robot.id, enabled: true }]
            }
          ]
        },
        commit: { enabled: true, rules: [] },
        merge_request: { enabled: true, rules: [] }
      }
    });

    try {
      await repositoriesController.deleteRobot(created.repo.id, robot.id);
      throw new Error('expected deleteRobot to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(409);
      expect((err as HttpException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'ROBOT_IN_USE',
          usages: [expect.objectContaining({ ruleId: 'rule-1', eventKey: 'issue' })]
        })
      );
    }
    expect(await repoRobotService.getById(robot.id)).not.toBeNull();
  });

  test('allows deletion when the robot is not referenced', async () => {
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
      username: 'owner-delete-ok',
      password: 'pass123'
    });
    const created = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'repo-2' });
    await repositoryService.markWebhookVerified(created.repo.id);
    const robot = await repoRobotService.createRobot({ id: owner.id }, created.repo.id, {
      name: 'hookcode-review-2',
      promptDefault: 'PROMPT',
      isDefault: false
    });

    await repoAutomationService.updateConfig(created.repo.id, {
      version: 2,
      events: {
        issue: { enabled: true, rules: [] },
        commit: { enabled: true, rules: [] },
        merge_request: { enabled: true, rules: [] }
      }
    });

    const result = await repositoriesController.deleteRobot(created.repo.id, robot.id);
    expect(result).toEqual({ ok: true });
    expect(await repoRobotService.getById(robot.id)).toBeNull();
  });
});
