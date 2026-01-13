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

describeDb('Automation rule validation (rule name + at least 1 robot action)', () => {
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

  test('rejects empty rule.actions (400)', async () => {
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
      username: 'owner-automation-rule-robot-required',
      password: 'pass123'
    });
    const created = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'repo-1' });
    await repositoryService.markWebhookVerified(created.repo.id);

    const body = {
      config: {
        version: 2,
        events: {
          issue: {
            enabled: true,
            rules: [
              {
                id: 'rule-1',
                name: 'rule 1',
                enabled: true,
                actions: []
              }
            ]
          },
          commit: { enabled: true, rules: [] },
          merge_request: { enabled: true, rules: [] }
        }
      }
    } as any;

    try {
      await repositoriesController.updateAutomation(created.repo.id, body);
      throw new Error('expected updateAutomation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(400);
      expect((err as HttpException).getResponse()).toEqual(expect.objectContaining({ code: 'RULE_ROBOT_REQUIRED' }));
    }
  });

  test('rejects empty rule.name (400)', async () => {
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
      username: 'owner-automation-rule-name-required',
      password: 'pass123'
    });
    const created = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'repo-1' });
    await repositoryService.markWebhookVerified(created.repo.id);

    const body = {
      config: {
        version: 2,
        events: {
          issue: {
            enabled: true,
            rules: [
              {
                id: 'rule-1',
                name: '',
                enabled: true,
                actions: [{ id: 'act-1', robotId: 'rb-1', enabled: true }]
              }
            ]
          },
          commit: { enabled: true, rules: [] },
          merge_request: { enabled: true, rules: [] }
        }
      }
    } as any;

    try {
      await repositoriesController.updateAutomation(created.repo.id, body);
      throw new Error('expected updateAutomation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(400);
      expect((err as HttpException).getResponse()).toEqual(expect.objectContaining({ code: 'RULE_NAME_REQUIRED' }));
    }
  });
});
