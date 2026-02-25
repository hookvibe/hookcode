export {};

jest.mock('../../db', () => ({
  ensureSchema: jest.fn().mockResolvedValue(undefined),
  closeDb: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../adminTools/startAdminTools', () => ({
  startAdminTools: jest.fn().mockResolvedValue(null)
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: { create: jest.fn() }
}));

import { bootstrapHttpServer } from '../../bootstrap';
import { TaskService } from '../../modules/tasks/task.service';
import { UserService } from '../../modules/users/user.service';
import { NestFactory } from '@nestjs/core';

describe('bootstrapHttpServer', () => {
  test('passes global prefix exclude to Nest app', async () => {
    jest.useFakeTimers();

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
});
