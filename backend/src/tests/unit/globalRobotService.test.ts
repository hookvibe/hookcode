jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    worker: {
      findUnique: jest.fn()
    },
    globalRobot: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  }
}));

import { db } from '../../db';
import { GlobalRobotService, GlobalRobotValidationError } from '../../modules/repositories/global-robot.service';

const createService = (globalCredentials: unknown) =>
  new GlobalRobotService({
    getCredentialsRaw: jest.fn().mockResolvedValue(globalCredentials)
  } as any);

const baseGlobalRobotRow = () => ({
  id: 'global-robot-1',
  name: 'shared-review',
  permission: 'read',
  repoCredentialSource: 'global',
  repoCredentialProfileId: null,
  defaultWorkerId: null,
  promptDefault: 'Review this change',
  language: 'en',
  modelProvider: 'codex',
  modelProviderConfig: {
    credentialSource: 'user',
    model: 'gpt-5.1-codex-max',
    sandbox: 'read-only',
    model_reasoning_effort: 'medium',
    routingConfig: { mode: 'fixed', failoverPolicy: 'disabled' }
  },
  dependencyConfig: null,
  defaultBranch: null,
  defaultBranchRole: null,
  repoWorkflowMode: 'auto',
  timeWindowStartHour: null,
  timeWindowEndHour: null,
  enabled: true,
  isDefault: false,
  createdAt: new Date(0),
  updatedAt: new Date(0)
});

describe('global robot service', () => {
  // Cover save-time guards for shared global profile bindings so stale ids fail before execution reaches runtime resolution. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createRobot rejects missing explicit global repo credential profiles', async () => {
    const service = createService({
      github: { profiles: [{ id: 'github-default', remark: 'default', token: 'ghp_1' }], defaultProfileId: 'github-default' },
      gitlab: { profiles: [{ id: 'gitlab-default', remark: 'default', token: 'glpat_1' }], defaultProfileId: 'gitlab-default' }
    });

    await expect(
      service.createRobot(null, {
        name: 'shared-review',
        promptDefault: 'Review this change',
        repoCredentialSource: 'global',
        repoCredentialProfileId: 'missing-profile'
      })
    ).rejects.toMatchObject<Partial<GlobalRobotValidationError>>({
      name: 'GlobalRobotValidationError',
      message: 'repoCredentialProfileId does not exist in global credentials',
      code: 'GLOBAL_ROBOT_REPO_CREDENTIAL_PROFILE_NOT_FOUND'
    });

    expect(db.globalRobot.create).not.toHaveBeenCalled();
  });

  test('updateRobot rejects missing explicit global model credential profiles', async () => {
    const service = createService({
      codex: { profiles: [{ id: 'codex-default', remark: 'default', apiKey: 'sk-default' }], defaultProfileId: 'codex-default' }
    });
    (db.globalRobot.findUnique as any).mockResolvedValueOnce(baseGlobalRobotRow());

    await expect(
      service.updateRobot('global-robot-1', {
        modelProvider: 'codex',
        modelProviderConfig: {
          credentialSource: 'global',
          credentialProfileId: 'missing-profile',
          model: 'gpt-5.1-codex-max'
        }
      })
    ).rejects.toMatchObject<Partial<GlobalRobotValidationError>>({
      name: 'GlobalRobotValidationError',
      message: 'codex credentialProfileId does not exist in global credentials',
      code: 'GLOBAL_ROBOT_MODEL_CREDENTIAL_PROFILE_NOT_FOUND'
    });

    expect(db.globalRobot.update).not.toHaveBeenCalled();
  });
});
