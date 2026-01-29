export {};

import { Test } from '@nestjs/testing';
import { RepositoriesController } from '../../modules/repositories/repositories.controller';
import { HttpException } from '@nestjs/common';
import { RepoAutomationService } from '../../modules/repositories/repo-automation.service';
import { RepoRobotService } from '../../modules/repositories/repo-robot.service';
import { RepoWebhookDeliveryService } from '../../modules/repositories/repo-webhook-delivery.service';
import { RepositoryService } from '../../modules/repositories/repository.service';
import { UserService } from '../../modules/users/user.service';
// Use PreviewService token for controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
import { PreviewService } from '../../modules/tasks/preview.service';

describe('Repo webhook deliveries API', () => {
  // Provide a stable PreviewService mock to satisfy controller DI across tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
  const previewService = {};
  test('returns 404 when repo is missing', async () => {
    const repoWebhookDeliveryService = {
      listDeliveries: jest.fn(),
      getDelivery: jest.fn()
    };
    const repositoryService = { getById: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: repoWebhookDeliveryService },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    try {
      await controller.listWebhookDeliveries('r1', '50', undefined);
      throw new Error('expected listWebhookDeliveries to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
    expect(repoWebhookDeliveryService.listDeliveries).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('lists deliveries for authenticated users', async () => {
    const iso = new Date().toISOString();
    const repositoryService = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        provider: 'gitlab',
        name: 'hookcode',
        enabled: true,
        createdAt: iso,
        updatedAt: iso
      })
    };
    const repoWebhookDeliveryService = {
      listDeliveries: jest.fn().mockResolvedValue({
        deliveries: [
          {
            id: 'd1',
            repoId: 'r1',
            provider: 'gitlab',
            eventName: 'Push Hook',
            deliveryId: 'uuid-1',
            result: 'accepted',
            httpStatus: 202,
            taskIds: ['t1'],
            createdAt: new Date().toISOString()
          }
        ],
        nextCursor: 'd1'
      }),
      getDelivery: jest.fn()
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: repoWebhookDeliveryService },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    const result = await controller.listWebhookDeliveries('r1', '50', undefined);

    expect(repoWebhookDeliveryService.listDeliveries).toHaveBeenCalledWith('r1', expect.any(Object));
    expect(result).toEqual(expect.objectContaining({ deliveries: expect.any(Array) }));
    await moduleRef.close();
  });

  test('gets a delivery detail', async () => {
    const iso = new Date().toISOString();
    const repositoryService = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        provider: 'gitlab',
        name: 'hookcode',
        enabled: true,
        createdAt: iso,
        updatedAt: iso
      })
    };
    const repoWebhookDeliveryService = {
      listDeliveries: jest.fn(),
      getDelivery: jest.fn().mockResolvedValue({
        id: 'd1',
        repoId: 'r1',
        provider: 'gitlab',
        eventName: 'Push Hook',
        deliveryId: 'uuid-1',
        result: 'accepted',
        httpStatus: 202,
        taskIds: ['t1'],
        payload: { hello: 'world' },
        response: { tasks: [{ id: 't1', robotId: 'rb1' }] },
        createdAt: new Date().toISOString()
      })
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: repoWebhookDeliveryService },
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    const result = await controller.getWebhookDelivery('r1', 'd1');

    expect(repoWebhookDeliveryService.getDelivery).toHaveBeenCalledWith('r1', 'd1');
    expect(result).toEqual(expect.objectContaining({ delivery: expect.any(Object) }));
    await moduleRef.close();
  });
});
