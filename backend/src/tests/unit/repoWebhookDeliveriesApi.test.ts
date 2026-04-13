export {};

import { Test } from '@nestjs/testing';
import { RepositoriesController } from '../../modules/repositories/repositories.controller';
import { HttpException } from '@nestjs/common';
import { RepoAutomationService } from '../../modules/repositories/repo-automation.service';
import { RepoAccessService } from '../../modules/repositories/repo-access.service'; // Provide RepoAccessService mock for RBAC checks in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
import { RepoMemberService } from '../../modules/repositories/repo-member.service'; // Provide RepoMemberService mock for repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
import { RepoRobotService } from '../../modules/repositories/repo-robot.service';
import { RobotCatalogService } from '../../modules/repositories/robot-catalog.service';
import { RepoWebhookDeliveryService } from '../../modules/repositories/repo-webhook-delivery.service';
import { RepositoryService } from '../../modules/repositories/repository.service';
import { GlobalCredentialService } from '../../modules/repositories/global-credentials.service';
import { UserService } from '../../modules/users/user.service';
// Use PreviewService token for controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
import { PreviewService } from '../../modules/tasks/preview.service';
import { SkillsService } from '../../modules/skills/skills.service';
import { LogWriterService } from '../../modules/logs/log-writer.service'; // Provide log writer mock for webhook delivery tests. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

describe('Repo webhook deliveries API', () => {
  // Provide a stable PreviewService mock to satisfy controller DI across tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
  const previewService = {};
  const robotCatalogService = {};
  const globalCredentialService = {};
  // Provide a stable SkillsService mock to satisfy controller DI across tests. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const skillsService = {};
  // Provide a stable LogWriterService mock for audit logging dependencies. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  const logWriter = { logOperation: jest.fn(), logSystem: jest.fn(), logExecution: jest.fn() };
  // Provide a request user for RBAC-protected endpoints in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const req = { user: { id: 'u1', username: 'u1', roles: [] } } as any;
  test('returns 404 when repo is missing', async () => {
    const repoWebhookDeliveryService = {
      listDeliveries: jest.fn(),
      getDelivery: jest.fn()
    };
    const repositoryService = { getById: jest.fn().mockResolvedValue(null) };
    const repoAccessService = { requireRepoRead: jest.fn() }; // Stub repo access checks for webhook delivery tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RobotCatalogService, useValue: robotCatalogService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: repoWebhookDeliveryService },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    try {
      await controller.listWebhookDeliveries(req, 'r1', '50', undefined);
      throw new Error('expected listWebhookDeliveries to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
    expect(repoWebhookDeliveryService.listDeliveries).not.toHaveBeenCalled();
    expect(repoAccessService.requireRepoRead).not.toHaveBeenCalled();
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
    const repoAccessService = { requireRepoRead: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for list deliveries. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RobotCatalogService, useValue: robotCatalogService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: repoWebhookDeliveryService },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    const result = await controller.listWebhookDeliveries(req, 'r1', '50', undefined);

    expect(repoWebhookDeliveryService.listDeliveries).toHaveBeenCalledWith('r1', expect.any(Object));
    expect(repoAccessService.requireRepoRead).toHaveBeenCalledWith(req.user, 'r1');
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
    const repoAccessService = { requireRepoRead: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for delivery detail. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RobotCatalogService, useValue: robotCatalogService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: repoWebhookDeliveryService },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        { provide: GlobalCredentialService, useValue: globalCredentialService },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    const result = await controller.getWebhookDelivery(req, 'r1', 'd1');

    expect(repoWebhookDeliveryService.getDelivery).toHaveBeenCalledWith('r1', 'd1');
    expect(repoAccessService.requireRepoRead).toHaveBeenCalledWith(req.user, 'r1');
    expect(result).toEqual(expect.objectContaining({ delivery: expect.any(Object) }));
    await moduleRef.close();
  });
});
