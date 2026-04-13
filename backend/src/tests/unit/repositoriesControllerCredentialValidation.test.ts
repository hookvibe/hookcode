export {};

import { BadRequestException, HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LogWriterService } from '../../modules/logs/log-writer.service';
import { GlobalCredentialService } from '../../modules/repositories/global-credentials.service';
import { RepoAccessService } from '../../modules/repositories/repo-access.service';
import { RepoAutomationService } from '../../modules/repositories/repo-automation.service';
import { RepoMemberService } from '../../modules/repositories/repo-member.service';
import { RepoRobotService } from '../../modules/repositories/repo-robot.service';
import { RepoWebhookDeliveryService } from '../../modules/repositories/repo-webhook-delivery.service';
import { RepoScopedCredentialValidationError, RepositoryService } from '../../modules/repositories/repository.service';
import { RepositoriesController } from '../../modules/repositories/repositories.controller';
import { RobotCatalogService } from '../../modules/repositories/robot-catalog.service';
import { SkillsService } from '../../modules/skills/skills.service';
import { PreviewService } from '../../modules/tasks/preview.service';
import { UserService } from '../../modules/users/user.service';

describe('RepositoriesController credential validation', () => {
  const repositoryService = {
    getById: jest.fn(),
    updateRepository: jest.fn()
  };
  const repoAccessService = {
    requireRepoManage: jest.fn()
  };
  const logWriter = {
    logOperation: jest.fn(),
    logSystem: jest.fn(),
    logExecution: jest.fn()
  };
  const req = { user: { id: 'u1', username: 'alice', roles: [] } } as any;

  beforeEach(() => {
    // Reset repository controller mocks between cases so repo-scoped credential validation mapping assertions stay isolated. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    jest.clearAllMocks();
  });

  test('maps repo-scoped credential validation errors to 400 responses', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoryService, useValue: repositoryService },
        { provide: RepoRobotService, useValue: {} },
        { provide: RobotCatalogService, useValue: {} },
        { provide: RepoAutomationService, useValue: {} },
        { provide: RepoWebhookDeliveryService, useValue: {} },
        { provide: RepoAccessService, useValue: repoAccessService },
        { provide: RepoMemberService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: GlobalCredentialService, useValue: {} },
        { provide: PreviewService, useValue: {} },
        { provide: SkillsService, useValue: {} },
        { provide: LogWriterService, useValue: logWriter }
      ]
    }).compile();
    const controller = moduleRef.get(RepositoriesController);
    repositoryService.getById.mockResolvedValueOnce({
      id: 'r1',
      provider: 'gitlab',
      name: 'group/project',
      enabled: true,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    repoAccessService.requireRepoManage.mockResolvedValueOnce(undefined);
    repositoryService.updateRepository.mockRejectedValueOnce(
      new RepoScopedCredentialValidationError('model provider credential profile remark is required', {
        code: 'REPO_SCOPED_CREDENTIAL_MODEL_PROFILE_REMARK_REQUIRED',
        details: { scope: 'repo_scoped', provider: 'codex', profileId: 'codex-1' }
      })
    );

    try {
      await controller.patch(req, 'r1', {
        modelProviderCredential: { codex: { profiles: [{ id: 'codex-1', remark: '' }] } }
      } as any);
      throw new Error('expected patch to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as HttpException).getStatus()).toBe(400);
      expect((err as HttpException).getResponse()).toEqual(
        expect.objectContaining({
          error: 'model provider credential profile remark is required',
          code: 'REPO_SCOPED_CREDENTIAL_MODEL_PROFILE_REMARK_REQUIRED',
          details: { scope: 'repo_scoped', provider: 'codex', profileId: 'codex-1' }
        })
      );
    }

    await moduleRef.close();
  });
});
