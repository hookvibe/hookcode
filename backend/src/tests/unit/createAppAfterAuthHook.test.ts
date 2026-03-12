export {};

jest.mock('../../db', () => ({
  ensureSchema: jest.fn().mockResolvedValue(undefined),
  closeDb: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../adminTools/startAdminTools', () => ({
  startAdminTools: jest.fn().mockResolvedValue(null)
}));

// Mock worker auto-start mode parsing so bootstrap tests can cover local versus disabled behavior deterministically. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
jest.mock('../../modules/workers/system-worker-config', () => ({
  readSystemWorkerMode: jest.fn()
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: { create: jest.fn() }
}));

import { bootstrapHttpServer } from '../../bootstrap';
import { TaskService } from '../../modules/tasks/task.service';
import { UserService } from '../../modules/users/user.service';
import { LogWriterService } from '../../modules/logs/log-writer.service';
import { NestFactory } from '@nestjs/core';
import { readSystemWorkerMode } from '../../modules/workers/system-worker-config';

describe('bootstrapHttpServer', () => {
  test('passes global prefix exclude to Nest app', async () => {
    jest.useFakeTimers();
    (readSystemWorkerMode as jest.Mock).mockReturnValue('local');

    const userService = { ensureBootstrapUser: jest.fn().mockResolvedValue(undefined), getById: jest.fn() };
    const taskService = { recoverStaleProcessing: jest.fn().mockResolvedValue(0) };

    const app = {
      enableCors: jest.fn(),
      useGlobalPipes: jest.fn(),
      // Stub global filter registration for bootstrap coverage. docs/en/developer/plans/im5mpw0g5827wu95w4ki/task_plan.md im5mpw0g5827wu95w4ki
      useGlobalFilters: jest.fn(),
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      get: jest.fn((token: any) => {
        if (token === UserService) return userService;
        if (token === TaskService) return taskService;
        return null;
      })
    };

    (NestFactory.create as unknown as jest.Mock).mockResolvedValue(app);

    const handle = await bootstrapHttpServer({
      rootModule: class TestModule {},
      logTag: '[test]',
      globalPrefix: 'api',
      globalPrefixExclude: ['webhook/billing'],
      host: '127.0.0.1',
      port: 0
    });

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api', { exclude: ['webhook/billing'] });

    await handle.stop();
  });

  test('logs when worker auto-start is disabled', async () => {
    jest.useFakeTimers();
    // Verify disabled deployments stay bootable while reporting that no worker is auto-started. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
    (readSystemWorkerMode as jest.Mock).mockReturnValue('disabled');

    const logWriter = { logSystem: jest.fn() };
    const userService = { ensureBootstrapUser: jest.fn().mockResolvedValue(undefined), getById: jest.fn() };
    const taskService = { recoverStaleProcessing: jest.fn().mockResolvedValue(0) };

    const app = {
      enableCors: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalFilters: jest.fn(),
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      get: jest.fn((token: any) => {
        if (token === UserService) return userService;
        if (token === TaskService) return taskService;
        if (token === LogWriterService) return logWriter;
        return null;
      })
    };

    (NestFactory.create as unknown as jest.Mock).mockResolvedValue(app);

    const handle = await bootstrapHttpServer({
      rootModule: class TestModule {},
      logTag: '[test]',
      globalPrefix: 'api',
      host: '127.0.0.1',
      port: 0
    });

    expect(logWriter.logSystem).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WORKER_AUTOSTART_DISABLED' })
    );

    await handle.stop();
  });
});
