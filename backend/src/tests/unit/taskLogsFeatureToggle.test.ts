export {};

import { Test } from '@nestjs/testing';
import { TasksController } from '../../modules/tasks/tasks.controller';
import { HttpException } from '@nestjs/common';
import { TaskLogStream } from '../../modules/tasks/task-log-stream.service';
import { TaskGitPushService } from '../../modules/tasks/task-git-push.service'; // Provide TaskGitPushService token for unit test DI. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
import { TaskRunner } from '../../modules/tasks/task-runner.service';
import { TaskService } from '../../modules/tasks/task.service';
import { RepoAccessService } from '../../modules/repositories/repo-access.service'; // Provide RepoAccessService mock for RBAC checks in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
import { isTaskLogsDbEnabled, isTaskLogsEnabled, isTaskLogsVisibleEnabled } from '../../config/features';

// Verify task logs toggles with only the new env variables after legacy removal. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225
describe('task logs feature toggles (TASK_LOGS_DB_ENABLED / TASK_LOGS_VISIBLE_ENABLED)', () => {
  // Provide a request user for RBAC-protected endpoints in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const req = { user: { id: 'u1', username: 'u1', roles: [] } } as any;
  const snapshotEnv = () => ({
    TASK_LOGS_DB_ENABLED: process.env.TASK_LOGS_DB_ENABLED,
    TASK_LOGS_VISIBLE_ENABLED: process.env.TASK_LOGS_VISIBLE_ENABLED
  });

  const restoreEnv = (prev: ReturnType<typeof snapshotEnv>) => {
    // Restore env per test to avoid cross-test contamination after dropping legacy toggles. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225
    if (prev.TASK_LOGS_DB_ENABLED !== undefined) process.env.TASK_LOGS_DB_ENABLED = prev.TASK_LOGS_DB_ENABLED;
    else delete process.env.TASK_LOGS_DB_ENABLED;
    if (prev.TASK_LOGS_VISIBLE_ENABLED !== undefined)
      process.env.TASK_LOGS_VISIBLE_ENABLED = prev.TASK_LOGS_VISIBLE_ENABLED;
    else delete process.env.TASK_LOGS_VISIBLE_ENABLED;
  };

  test('logs endpoints return 404 when visibility is disabled (persist may still be enabled)', async () => {
    const prev = snapshotEnv();
    process.env.TASK_LOGS_DB_ENABLED = 'true';
    process.env.TASK_LOGS_VISIBLE_ENABLED = 'false';

    expect(isTaskLogsDbEnabled()).toBe(true);
    expect(isTaskLogsVisibleEnabled()).toBe(false);
    expect(isTaskLogsEnabled()).toBe(false);

    const taskService = { getTask: jest.fn() } as any;
    const taskLogStream = { subscribe: jest.fn() } as any;
    const taskRunner = {} as any;
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for task log tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    // Stub TaskGitPushService to satisfy TasksController DI in unit tests. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
    const taskGitPushService = {} as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLogStream, useValue: taskLogStream },
        { provide: TaskRunner, useValue: taskRunner },
        // Provide TaskGitPushService in the test module to match controller constructor. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
        { provide: TaskGitPushService, useValue: taskGitPushService },
        { provide: RepoAccessService, useValue: repoAccessService } // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      ]
    }).compile();
    const ctrl = moduleRef.get(TasksController);

    try {
      await ctrl.logs(req, 't1', undefined);
      throw new Error('expected logs to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
    expect(taskService.getTask).not.toHaveBeenCalled();

    try {
      await ctrl.clearLogs(req, 't1');
      throw new Error('expected clearLogs to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }

    await moduleRef.close();
    restoreEnv(prev);
  });

  test('logs endpoint works when visible (defaults to enabled when unset)', async () => {
    const prev = snapshotEnv();
    delete process.env.TASK_LOGS_DB_ENABLED;
    delete process.env.TASK_LOGS_VISIBLE_ENABLED;

    expect(isTaskLogsDbEnabled()).toBe(true);
    expect(isTaskLogsVisibleEnabled()).toBe(true);
    expect(isTaskLogsEnabled()).toBe(true);

    const taskService = {
      getTask: jest.fn().mockResolvedValue({ id: 't1', result: { logs: ['l1', 'l2'], logsSeq: 2 } })
    } as any;
    const taskLogStream = { subscribe: jest.fn() } as any;
    const taskRunner = {} as any;
    const repoAccessService = { requireRepoManage: jest.fn().mockResolvedValue(undefined) }; // Stub repo access checks for task log tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    // Stub TaskGitPushService to satisfy TasksController DI in unit tests. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
    const taskGitPushService = {} as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLogStream, useValue: taskLogStream },
        { provide: TaskRunner, useValue: taskRunner },
        // Provide TaskGitPushService in the test module to match controller constructor. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
        { provide: TaskGitPushService, useValue: taskGitPushService },
        { provide: RepoAccessService, useValue: repoAccessService } // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      ]
    }).compile();
    const ctrl = moduleRef.get(TasksController);

    const result = await ctrl.logs(req, 't1', undefined);
    expect(result).toEqual({ logs: ['l1', 'l2'] });

    await moduleRef.close();
    restoreEnv(prev);
  });

});
