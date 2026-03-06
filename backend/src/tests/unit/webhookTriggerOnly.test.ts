export {};

jest.mock('../../agent/reporter', () => ({
  __esModule: true,
  postToProvider: jest.fn().mockResolvedValue(undefined)
}));

import { callAgent, setAgentServices } from '../../agent/agent';

describe('Webhook / Agent legacy guardrails', () => {
  test('legacy task without repoId is rejected', async () => {
    const taskService = {
      patchResult: jest.fn(),
      ensureTaskGroupId: jest.fn().mockResolvedValue(null),
      getTaskGroupThreadId: jest.fn().mockResolvedValue(null),
      bindTaskGroupThreadId: jest.fn().mockResolvedValue(false)
    } as any;

    // Provide dependency-related services required by agent initialization. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    setAgentServices({
      taskService,
      taskLogStream: { publish: jest.fn(), subscribe: jest.fn() } as any,
      taskLogsService: { appendLog: jest.fn() } as any, // Stub task_logs persistence for agent guardrail tests. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      repositoryService: {} as any,
      repoRobotService: {} as any,
      userService: {} as any,
      userApiTokenService: { createToken: jest.fn(), verifyToken: jest.fn() } as any,
      runtimeService: { hasRuntime: jest.fn().mockReturnValue(true) } as any,
      hookcodeConfigService: { parseConfig: jest.fn().mockResolvedValue(null) } as any,
      skillsService: {
        buildPromptPrefix: jest.fn().mockResolvedValue(''),
        syncExtraSkillsToTaskGroup: jest.fn().mockResolvedValue(undefined)
      } as any // Stub skills registry for agent guardrail tests. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    });

    await expect(
      callAgent({
        id: 't1',
        eventType: 'commit',
        status: 'queued',
        payload: {},
        retries: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any)
    ).rejects.toThrow(/missing repoId/i);

    expect(taskService.patchResult).not.toHaveBeenCalled();
  });
});
