export {};

import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { RepositoriesController } from '../../modules/repositories/repositories.controller';
import { RepoAutomationService } from '../../modules/repositories/repo-automation.service';
import { RepoRobotService } from '../../modules/repositories/repo-robot.service';
import { RepoWebhookDeliveryService } from '../../modules/repositories/repo-webhook-delivery.service';
import { RepositoryService } from '../../modules/repositories/repository.service';
import { UserService } from '../../modules/users/user.service';
// Use PreviewService token for controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
import { PreviewService } from '../../modules/tasks/preview.service';

describe('Archived repo read-only API guard', () => {
  // Provide a stable PreviewService mock to satisfy controller DI across tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
  const previewService = {};
  const archivedRepo = () => {
    const iso = '2026-01-20T00:00:00.000Z';
    return { id: 'r1', provider: 'gitlab', name: 'hookcode', enabled: true, archivedAt: iso, createdAt: iso, updatedAt: iso };
  };

  // Assert that archived repos reject write endpoints with a stable 403 error code. qnp1mtxhzikhbi0xspbc
  const expectArchivedReadOnly = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      throw new Error('expected controller call to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const http = err as HttpException;
      expect(http.getStatus()).toBe(403);
      expect(http.getResponse()).toEqual(expect.objectContaining({ code: 'REPO_ARCHIVED_READ_ONLY' }));
    }
  };

  test('blocks PATCH /repos/:id when repo is archived', async () => {
    // Ensure archived repositories are strictly read-only at the controller layer. qnp1mtxhzikhbi0xspbc
    const repositoryService = {
      getById: jest.fn().mockResolvedValue(archivedRepo()),
      updateRepository: jest.fn()
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.patch('r1', {} as any));
    expect(repositoryService.updateRepository).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks POST /repos/:id/robots when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { createRobot: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.createRobot('r1', {} as any, {} as any));
    expect(repoRobotService.createRobot).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks PATCH /repos/:id/robots/:robotId when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { getByIdWithToken: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.patchRobot('r1', 'rb1', {} as any, {} as any));
    expect(repoRobotService.getByIdWithToken).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks POST /repos/:id/robots/:robotId/test when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { getByIdWithToken: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.testRobot('r1', 'rb1', {} as any));
    expect(repoRobotService.getByIdWithToken).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks DELETE /repos/:id/robots/:robotId when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { getById: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.deleteRobot('r1', 'rb1'));
    expect(repoRobotService.getById).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks PUT /repos/:id/automation when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoAutomationService = { updateConfig: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RepoAutomationService, useValue: repoAutomationService },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.updateAutomation('r1', { config: {} } as any));
    expect(repoAutomationService.updateConfig).not.toHaveBeenCalled();
    await moduleRef.close();
  });
});
