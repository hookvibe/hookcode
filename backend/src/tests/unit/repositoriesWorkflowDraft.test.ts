jest.mock('../../db', () => ({
  __esModule: true,
  db: {}
}));

jest.mock('../../services/githubService', () => ({
  __esModule: true,
  GithubService: jest.fn().mockImplementation(() => ({
    getRepository: jest.fn(),
    getRepositoryById: jest.fn()
  }))
}));

jest.mock('../../services/gitlabService', () => ({
  __esModule: true,
  GitlabService: jest.fn().mockImplementation(() => ({
    getProject: jest.fn(),
    getCurrentUser: jest.fn(),
    getProjectMember: jest.fn()
  }))
}));

jest.mock('../../services/repoRobotAccess', () => {
  const actual = jest.requireActual('../../services/repoRobotAccess');
  return { __esModule: true, ...actual, resolveRobotProviderToken: jest.fn() };
});

jest.mock('../../services/repoWorkflowMode', () => {
  const actual = jest.requireActual('../../services/repoWorkflowMode');
  return { __esModule: true, ...actual, ensureGithubForkRepo: jest.fn(), ensureGitlabForkProject: jest.fn() };
});

import { GithubService } from '../../services/githubService';
import { ensureGithubForkRepo } from '../../services/repoWorkflowMode';
import { resolveRobotProviderToken } from '../../services/repoRobotAccess';
import { RepositoriesController } from '../../modules/repositories/repositories.controller';

describe('RepositoriesController draft workflow test', () => {
  const buildController = (repoOverrides?: Partial<any>) => {
    const repositoryService = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        provider: 'github',
        name: 'alice/repo1',
        externalId: '',
        apiBaseUrl: '',
        archivedAt: null,
        ...repoOverrides
      }),
      getRepoScopedCredentials: jest.fn().mockResolvedValue({ repoProvider: null })
    } as any;

    const repoAccessService = {
      requireRepoManage: jest.fn().mockResolvedValue(undefined)
    } as any;

    const userService = {
      getModelCredentialsRaw: jest.fn().mockResolvedValue({})
    } as any;

    const logWriter = {
      logOperation: jest.fn().mockResolvedValue(undefined)
    } as any;

    const controller = new RepositoriesController(
      repositoryService,
      repoAccessService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      userService,
      {} as any,
      {} as any,
      logWriter
    );

    return { controller, repositoryService, repoAccessService, userService, logWriter };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns ok=false for direct workflow when token cannot push', async () => {
    // Validate draft workflow checks fail fast when direct mode lacks upstream push permission. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    (resolveRobotProviderToken as unknown as jest.Mock).mockReturnValueOnce('token-123');

    const getRepository = jest.fn().mockResolvedValue({
      full_name: 'alice/repo1',
      permissions: { admin: false, maintain: false, push: false }
    });
    (GithubService as unknown as jest.Mock).mockImplementationOnce(() => ({
      getRepository,
      getRepositoryById: jest.fn()
    }));

    const { controller, logWriter, repoAccessService } = buildController();

    const req = { user: { id: 'u1' } } as any;
    const body = { mode: 'direct', repoCredentialSource: 'user', permission: 'write' } as any;
    const result = await controller.testRepoWorkflowDraft('r1', req, body);

    expect(repoAccessService.requireRepoManage).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'r1');
    expect(getRepository).toHaveBeenCalledWith('alice', 'repo1');
    expect(result).toEqual({
      ok: false,
      mode: 'direct',
      message: 'token lacks upstream push permission for direct workflow'
    });
    expect(ensureGithubForkRepo).not.toHaveBeenCalled();
    expect(logWriter.logOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'REPO_WORKFLOW_CHECK_FAILED',
        actorUserId: 'u1',
        repoId: 'r1'
      })
    );
  });

  test('returns fork mode for auto workflow when token cannot push', async () => {
    // Ensure draft workflow checks resolve auto to fork when write tokens cannot push. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    (resolveRobotProviderToken as unknown as jest.Mock).mockReturnValueOnce('token-123');

    const getRepository = jest.fn().mockResolvedValue({
      full_name: 'alice/repo1',
      permissions: { admin: false, maintain: false, push: false }
    });
    (GithubService as unknown as jest.Mock).mockImplementationOnce(() => ({
      getRepository,
      getRepositoryById: jest.fn()
    }));

    const { controller } = buildController();

    const req = { user: { id: 'u1' } } as any;
    const body = { mode: 'auto', repoCredentialSource: 'user', permission: 'write' } as any;
    const result = await controller.testRepoWorkflowDraft('r1', req, body);

    expect(result).toEqual({ ok: true, mode: 'fork', message: 'fork workflow check ok' });
    expect(ensureGithubForkRepo).toHaveBeenCalledTimes(1);
  });
});

