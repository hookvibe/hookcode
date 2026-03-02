export {};

import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LogsController } from '../../modules/logs/logs.controller';
import { LogsService } from '../../modules/logs/logs.service';
import { RepoAccessService } from '../../modules/repositories/repo-access.service';
import { EventStreamService } from '../../modules/events/event-stream.service';

// Verify admin guard behavior for system log APIs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
describe('LogsController', () => {
  const buildModule = async (isAdmin: boolean) => {
    const logsService = { listLogs: jest.fn().mockResolvedValue({ logs: [] }) } as any;
    const repoAccessService = { isAdmin: jest.fn().mockReturnValue(isAdmin) } as any;
    const eventStreamService = { subscribe: jest.fn() } as any;

    const moduleRef = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [
        { provide: LogsService, useValue: logsService },
        { provide: RepoAccessService, useValue: repoAccessService },
        { provide: EventStreamService, useValue: eventStreamService }
      ]
    }).compile();

    return { moduleRef, logsService };
  };

  test('rejects non-admin callers', async () => {
    const { moduleRef } = await buildModule(false);
    const ctrl = moduleRef.get(LogsController);
    const req = { user: { id: 'u1', roles: [] } } as any;

    await expect(ctrl.list(req, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toBeInstanceOf(
      ForbiddenException
    );

    await moduleRef.close();
  });

  test('returns logs for admins', async () => {
    const { moduleRef, logsService } = await buildModule(true);
    const ctrl = moduleRef.get(LogsController);
    const req = { user: { id: 'u1', roles: ['admin'] } } as any;

    const result = await ctrl.list(req, '5', undefined, undefined, undefined, undefined, undefined, undefined, undefined);

    expect(result).toEqual({ logs: [] });
    expect(logsService.listLogs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, category: null, level: null, repoId: null })
    );

    await moduleRef.close();
  });
});
