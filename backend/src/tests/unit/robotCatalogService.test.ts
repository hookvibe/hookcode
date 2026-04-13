import { RobotCatalogService } from '../../modules/repositories/robot-catalog.service';

describe('RobotCatalogService', () => {
  const repoRobotService = {
    listByRepo: jest.fn(),
    listByRepoWithToken: jest.fn(),
    getById: jest.fn(),
    getByIdWithToken: jest.fn()
  };
  const globalRobotService = {
    listEnabled: jest.fn(),
    listEnabledWithConfig: jest.fn(),
    getById: jest.fn(),
    getByIdWithConfig: jest.fn()
  };

  beforeEach(() => {
    // Keep mixed-scope robot catalog tests isolated so direct-id lookup hardening does not leak mock state across cases. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    jest.clearAllMocks();
  });

  test('prefers repo robots before global direct-id lookup', async () => {
    const service = new RobotCatalogService(repoRobotService as any, globalRobotService as any);
    const repoRobot = { id: 'repo-1', scope: 'repo', repoId: 'r1', enabled: true };
    repoRobotService.getByIdWithToken.mockResolvedValueOnce(repoRobot);

    const result = await service.getByIdWithToken('repo-1');

    expect(result).toBe(repoRobot);
    expect(globalRobotService.getByIdWithConfig).not.toHaveBeenCalled();
  });

  test('returns enabled global robots for direct-id lookup when no repo robot matches', async () => {
    const service = new RobotCatalogService(repoRobotService as any, globalRobotService as any);
    const globalRobot = { id: 'global-1', scope: 'global', enabled: true };
    repoRobotService.getByIdWithToken.mockResolvedValueOnce(null);
    globalRobotService.getByIdWithConfig.mockResolvedValueOnce(globalRobot);

    const result = await service.getByIdWithToken('global-1');

    expect(result).toBe(globalRobot);
  });

  test('filters disabled global robots from direct-id execution lookups', async () => {
    const service = new RobotCatalogService(repoRobotService as any, globalRobotService as any);
    repoRobotService.getByIdWithToken.mockResolvedValueOnce(null);
    globalRobotService.getByIdWithConfig.mockResolvedValueOnce({ id: 'global-1', scope: 'global', enabled: false });

    const result = await service.getByIdWithToken('global-1');

    expect(result).toBeNull();
  });
});
