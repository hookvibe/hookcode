export {};

import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { isTaskLogsDbEnabled, isTaskLogsEnabled, isTaskLogsVisibleEnabled } from '../../config/features';
import { LogWriterService } from '../../modules/logs/log-writer.service';
import { RepoAccessService } from '../../modules/repositories/repo-access.service'; // Provide RepoAccessService mock for RBAC checks in unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
import { TaskGitPushService } from '../../modules/tasks/task-git-push.service'; // Provide TaskGitPushService token for unit test DI. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124
import { TaskLogStream } from '../../modules/tasks/task-log-stream.service';
import { TaskLogsService } from '../../modules/tasks/task-logs.service';
import { TaskRunner } from '../../modules/tasks/task-runner.service';
import { TaskService } from '../../modules/tasks/task.service';
import { TasksController } from '../../modules/tasks/tasks.controller';
import { TaskWorkspaceService } from '../../modules/tasks/task-workspace.service';
import { WorkersConnectionService } from '../../modules/workers/workers-connection.service';

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
    if (prev.TASK_LOGS_VISIBLE_ENABLED !== undefined) process.env.TASK_LOGS_VISIBLE_ENABLED = prev.TASK_LOGS_VISIBLE_ENABLED;
    else delete process.env.TASK_LOGS_VISIBLE_ENABLED;
  };

  const buildController = async(params: {
    taskService: any;
    taskLogStream: any;
    taskLogsService: any;
    taskRunner: any;
    repoAccessService: any;
    logWriter: any;
  }) => {
    const taskGitPushService = {} as any;
    const taskWorkspaceService = {} as TaskWorkspaceService; // Keep log-toggle controller tests aligned with the current workspace dependency graph. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const workersConnections = {} as WorkersConnectionService; // Keep controller toggle tests aligned with the new worker control dependency. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TaskService, useValue: params.taskService },
        { provide: TaskLogStream, useValue: params.taskLogStream },
        { provide: TaskLogsService, useValue: params.taskLogsService }, // Wire task log table service into controller tests. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
        { provide: TaskRunner, useValue: params.taskRunner },
        { provide: LogWriterService, useValue: params.logWriter }, // Include log writer for audit logging in log clears. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
        { provide: TaskGitPushService, useValue: taskGitPushService },
        { provide: TaskWorkspaceService, useValue: taskWorkspaceService },
        { provide: RepoAccessService, useValue: params.repoAccessService }, // Inject RepoAccessService mock for RBAC guard coverage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        { provide: WorkersConnectionService, useValue: workersConnections } // Keep TasksController tests compatible with worker control injection. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      ]
    }).compile();
  };

  test('logs endpoints return 404 when visibility is disabled (persist may still be enabled)', async () => {
    const prev = snapshotEnv();
    process.env.TASK_LOGS_DB_ENABLED = 'true';
    process.env.TASK_LOGS_VISIBLE_ENABLED = 'false';

    expect(isTaskLogsDbEnabled()).toBe(true);
    expect(isTaskLogsVisibleEnabled()).toBe(false);
    expect(isTaskLogsEnabled()).toBe(false);

    const moduleRef = await buildController({
      taskService: { getTaskAccessSummary: jest.fn() } as any,
      taskLogStream: { subscribe: jest.fn() } as any,
      taskLogsService: {} as TaskLogsService,
      taskRunner: {} as any,
      repoAccessService: { requireRepoManage: jest.fn().mockResolvedValue(undefined) } as any,
      logWriter: { logExecution: jest.fn().mockResolvedValue(undefined) } as any
    });
    const ctrl = moduleRef.get(TasksController);
    const taskService = moduleRef.get(TaskService) as any;

    try {
      await ctrl.logs(req, 't1', undefined, undefined, undefined); // Match logs signature with paging params. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      throw new Error('expected logs to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
    expect(taskService.getTaskAccessSummary).not.toHaveBeenCalled();

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

    const taskLogsService = {
      // Return paged logs from the task_logs table for the logs endpoint. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      getTail: jest.fn().mockResolvedValue({ logs: ['l1', 'l2'], startSeq: 1, endSeq: 2, nextBefore: undefined })
    } as any;
    const moduleRef = await buildController({
      taskService: {
        getTaskAccessSummary: jest.fn().mockResolvedValue({ id: 't1' }) // Stub minimal task lookup for log access checks. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      } as any,
      taskLogStream: { subscribe: jest.fn() } as any,
      taskLogsService,
      taskRunner: {} as any,
      repoAccessService: { requireRepoManage: jest.fn().mockResolvedValue(undefined) } as any,
      logWriter: { logExecution: jest.fn().mockResolvedValue(undefined) } as any
    });
    const ctrl = moduleRef.get(TasksController);

    const result = await ctrl.logs(req, 't1', undefined, undefined, undefined);
    expect(result).toEqual({ logs: ['l1', 'l2'], startSeq: 1, endSeq: 2, nextBefore: undefined });
    expect(taskLogsService.getTail).toHaveBeenCalledWith('t1', 200);

    await moduleRef.close();
    restoreEnv(prev);
  });
});
