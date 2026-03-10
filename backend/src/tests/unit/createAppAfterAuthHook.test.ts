export {};

jest.mock('../../db', () => ({
  ensureSchema: jest.fn().mockResolvedValue(undefined),
  closeDb: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../adminTools/startAdminTools', () => ({
  startAdminTools: jest.fn().mockResolvedValue(null)
}));

// Mock system worker config to simulate external bootstrap failures. docs/en/developer/plans/ci-backend-start-20260310/task_plan.md ci-backend-start-20260310
jest.mock('../../modules/workers/system-worker-config', () => ({
  readSystemWorkerMode: jest.fn(),
  readExternalSystemWorkerConfig: jest.fn()
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: { create: jest.fn() }
}));

import { bootstrapHttpServer } from '../../bootstrap';
import { TaskService } from '../../modules/tasks/task.service';
import { UserService } from '../../modules/users/user.service';
import { LogWriterService } from '../../modules/logs/log-writer.service';
import { NestFactory } from '@nestjs/core';
import {
  readExternalSystemWorkerConfig,
  readSystemWorkerMode
} from '../../modules/workers/system-worker-config';

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

  test('does not crash when external system worker bootstrap fails', async () => {
    jest.useFakeTimers();
    // Verify external worker bootstrap errors are logged without aborting startup. docs/en/developer/plans/ci-backend-start-20260310/task_plan.md ci-backend-start-20260310
    (readSystemWorkerMode as jest.Mock).mockReturnValue('external');
    (readExternalSystemWorkerConfig as jest.Mock).mockImplementation(() => {
      throw new Error('worker bootstrap failed');
    });

    const logWriter = { logSystem: jest.fn() };
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
      expect.objectContaining({ code: 'WORKER_SYSTEM_BOOTSTRAP_FAILED' })
    );

    await handle.stop();
  });
});
