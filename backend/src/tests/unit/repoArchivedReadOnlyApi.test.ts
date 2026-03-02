export {};

import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { RepositoriesController } from '../../modules/repositories/repositories.controller';
import { RepoAutomationService } from '../../modules/repositories/repo-automation.service';
import { RepoAccessService } from '../../modules/repositories/repo-access.service'; // Provide RepoAccessService mock for RBAC checks in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
import { RepoMemberService } from '../../modules/repositories/repo-member.service'; // Provide RepoMemberService mock for repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
import { RepoRobotService } from '../../modules/repositories/repo-robot.service';
import { RepoWebhookDeliveryService } from '../../modules/repositories/repo-webhook-delivery.service';
import { RepositoryService } from '../../modules/repositories/repository.service';
import { UserService } from '../../modules/users/user.service';
// Use PreviewService token for controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
import { PreviewService } from '../../modules/tasks/preview.service';
import { SkillsService } from '../../modules/skills/skills.service';
import { LogWriterService } from '../../modules/logs/log-writer.service'; // Provide log writer mock for repo controller tests. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

describe('Archived repo read-only API guard', () => {
  // Provide a stable PreviewService mock to satisfy controller DI across tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
  const previewService = {};
  // Provide a stable SkillsService mock to satisfy controller DI across tests. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const skillsService = {};
  // Provide a stable LogWriterService mock for audit logging dependencies. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  const logWriter = { logOperation: jest.fn(), logSystem: jest.fn(), logExecution: jest.fn() };
  // Provide a request user for RBAC-protected endpoints in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const req = { user: { id: 'u1', username: 'u1', roles: [] } } as any;
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
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for archived read-only tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.patch(req, 'r1', {} as any));
    expect(repositoryService.updateRepository).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks POST /repos/:id/robots when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { createRobot: jest.fn() };
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for archived read-only tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.createRobot('r1', req, {} as any));
    expect(repoRobotService.createRobot).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks PATCH /repos/:id/robots/:robotId when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { getByIdWithToken: jest.fn() };
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for archived read-only tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.patchRobot('r1', 'rb1', req, {} as any));
    expect(repoRobotService.getByIdWithToken).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks POST /repos/:id/robots/:robotId/test when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { getByIdWithToken: jest.fn() };
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for archived read-only tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.testRobot('r1', 'rb1', req));
    expect(repoRobotService.getByIdWithToken).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks DELETE /repos/:id/robots/:robotId when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoRobotService = { getById: jest.fn() };
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for archived read-only tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: repoRobotService },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.deleteRobot(req, 'r1', 'rb1'));
    expect(repoRobotService.getById).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('blocks PUT /repos/:id/automation when repo is archived', async () => {
    const repositoryService = { getById: jest.fn().mockResolvedValue(archivedRepo()) };
    const repoAutomationService = { updateConfig: jest.fn() };
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for archived read-only tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226

    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RepoAutomationService, useValue: repoAutomationService },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: RepoAccessService, useValue: repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: RepoMemberService, useValue: {} }, // Inject RepoMemberService mock to satisfy repositories controller DI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: UserService, useValue: {} },
        // Provide PreviewService mock to satisfy controller DI in unit tests. docs/en/developer/plans/preview-service-test-di-20260129/task_plan.md preview-service-test-di-20260129
        { provide: PreviewService, useValue: previewService },
        { provide: SkillsService, useValue: skillsService },
        { provide: LogWriterService, useValue: logWriter } // Inject LogWriterService mock for audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);

    await expectArchivedReadOnly(() => controller.updateAutomation(req, 'r1', { config: {} } as any));
    expect(repoAutomationService.updateConfig).not.toHaveBeenCalled();
    await moduleRef.close();
  });
});
