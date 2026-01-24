export {};

import { Test } from '@nestjs/testing';
import { TasksController } from '../../modules/tasks/tasks.controller';
import { HttpException } from '@nestjs/common';
import { TaskLogStream } from '../../modules/tasks/task-log-stream.service';
import { TaskGitPushService } from '../../modules/tasks/task-git-push.service'; // Provide TaskGitPushService token for unit test DI. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
import { TaskRunner } from '../../modules/tasks/task-runner.service';
import { TaskService } from '../../modules/tasks/task.service';
import { isTaskLogsDbEnabled, isTaskLogsEnabled, isTaskLogsVisibleEnabled } from '../../config/features';

describe('task logs feature toggles (TASK_LOGS_DB_ENABLED / TASK_LOGS_VISIBLE_ENABLED)', () => {
  const snapshotEnv = () => ({
    TASK_LOGS_ENABLED: process.env.TASK_LOGS_ENABLED,
    TASK_LOGS_DB_ENABLED: process.env.TASK_LOGS_DB_ENABLED,
    TASK_LOGS_VISIBLE_ENABLED: process.env.TASK_LOGS_VISIBLE_ENABLED
  });

  const restoreEnv = (prev: ReturnType<typeof snapshotEnv>) => {
    // Restore env per test to avoid cross-test contamination. nykx5svtlgh050cstyht
    if (prev.TASK_LOGS_ENABLED !== undefined) process.env.TASK_LOGS_ENABLED = prev.TASK_LOGS_ENABLED;
    else delete process.env.TASK_LOGS_ENABLED;
    if (prev.TASK_LOGS_DB_ENABLED !== undefined) process.env.TASK_LOGS_DB_ENABLED = prev.TASK_LOGS_DB_ENABLED;
    else delete process.env.TASK_LOGS_DB_ENABLED;
    if (prev.TASK_LOGS_VISIBLE_ENABLED !== undefined)
      process.env.TASK_LOGS_VISIBLE_ENABLED = prev.TASK_LOGS_VISIBLE_ENABLED;
    else delete process.env.TASK_LOGS_VISIBLE_ENABLED;
  };

  test('logs endpoints return 404 when visibility is disabled (persist may still be enabled)', async () => {
    const prev = snapshotEnv();
    delete process.env.TASK_LOGS_ENABLED;
    process.env.TASK_LOGS_DB_ENABLED = 'true';
    process.env.TASK_LOGS_VISIBLE_ENABLED = 'false';

    expect(isTaskLogsDbEnabled()).toBe(true);
    expect(isTaskLogsVisibleEnabled()).toBe(false);
    expect(isTaskLogsEnabled()).toBe(false);

    const taskService = { getTask: jest.fn() } as any;
    const taskLogStream = { subscribe: jest.fn() } as any;
    const taskRunner = {} as any;
    // Stub TaskGitPushService to satisfy TasksController DI in unit tests. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
    const taskGitPushService = {} as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLogStream, useValue: taskLogStream },
        { provide: TaskRunner, useValue: taskRunner },
        // Provide TaskGitPushService in the test module to match controller constructor. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
        { provide: TaskGitPushService, useValue: taskGitPushService }
      ]
    }).compile();
    const ctrl = moduleRef.get(TasksController);

    try {
      await ctrl.logs('t1', undefined);
      throw new Error('expected logs to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
    expect(taskService.getTask).not.toHaveBeenCalled();

    try {
      await ctrl.clearLogs('t1');
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
    delete process.env.TASK_LOGS_ENABLED;
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
    // Stub TaskGitPushService to satisfy TasksController DI in unit tests. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
    const taskGitPushService = {} as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLogStream, useValue: taskLogStream },
        { provide: TaskRunner, useValue: taskRunner },
        // Provide TaskGitPushService in the test module to match controller constructor. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
        { provide: TaskGitPushService, useValue: taskGitPushService }
      ]
    }).compile();
    const ctrl = moduleRef.get(TasksController);

    const result = await ctrl.logs('t1', undefined);
    expect(result).toEqual({ logs: ['l1', 'l2'] });

    await moduleRef.close();
    restoreEnv(prev);
  });

  test('legacy TASK_LOGS_ENABLED=false disables logs when new vars are unset', async () => {
    const prev = snapshotEnv();
    process.env.TASK_LOGS_ENABLED = 'false';
    delete process.env.TASK_LOGS_DB_ENABLED;
    delete process.env.TASK_LOGS_VISIBLE_ENABLED;

    expect(isTaskLogsDbEnabled()).toBe(false);
    expect(isTaskLogsVisibleEnabled()).toBe(false);
    expect(isTaskLogsEnabled()).toBe(false);

    const taskService = { getTask: jest.fn() } as any;
    const taskLogStream = { subscribe: jest.fn() } as any;
    const taskRunner = {} as any;
    // Stub TaskGitPushService to satisfy TasksController DI in unit tests. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
    const taskGitPushService = {} as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: TaskLogStream, useValue: taskLogStream },
        { provide: TaskRunner, useValue: taskRunner },
        // Provide TaskGitPushService in the test module to match controller constructor. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
        { provide: TaskGitPushService, useValue: taskGitPushService }
      ]
    }).compile();
    const ctrl = moduleRef.get(TasksController);

    try {
      await ctrl.logs('t1', undefined);
      throw new Error('expected logs to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
    expect(taskService.getTask).not.toHaveBeenCalled();

    await moduleRef.close();
    restoreEnv(prev);
  });
});
