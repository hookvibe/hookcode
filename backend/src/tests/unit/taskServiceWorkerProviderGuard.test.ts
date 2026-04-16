jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    task: {
      aggregate: jest.fn(),
      create: jest.fn()
    },
    taskGroup: {
      upsert: jest.fn()
    }
  }
}));

import { db } from '../../db';
import { TaskCreationGuardError } from '../../modules/tasks/task-creation-guard-error';
import { TaskService } from '../../modules/tasks/task.service';

describe('TaskService worker provider guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.task.aggregate as jest.Mock).mockResolvedValue({ _max: { groupOrder: null } });
    (db.taskGroup.upsert as jest.Mock).mockResolvedValue({ id: 'group-1' });
  });

  test('fails before task creation when the assigned worker cannot run the robot provider', async () => {
    // Stop task creation before queueing when the chosen worker lacks the robot provider runtime, so Codex failures surface before dispatch. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
    const workersService = {
      findEffectiveWorkerId: jest.fn().mockResolvedValue('worker-1'),
      requireWorkerReadyForNewTask: jest.fn().mockResolvedValue({
        ok: false,
        code: 'WORKER_PROVIDER_NOT_READY',
        message: 'Codex is not prepared on remote-1. Prepare that runtime in the worker panel before starting the task.'
      })
    };
    const robotCatalogService = {
      getById: jest.fn().mockResolvedValue({ id: 'robot-1', modelProvider: 'codex' }),
      buildTaskRobotSummaryMap: jest.fn()
    };
    const logWriter = {
      logSystem: jest.fn(),
      logExecution: jest.fn()
    };

    const service = new TaskService(undefined, logWriter as any, robotCatalogService as any, undefined, workersService as any);

    await expect(
      service.createTask('chat', { __chat: { text: 'Ship it' } }, { repoId: 'repo-1', repoProvider: 'gitlab', robotId: 'robot-1' })
    ).rejects.toBeInstanceOf(TaskCreationGuardError);
    expect(workersService.requireWorkerReadyForNewTask).toHaveBeenCalledWith('worker-1', 'codex');
    expect(db.task.create).not.toHaveBeenCalled();
  });
});
