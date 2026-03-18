export {};

import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { WebhookEventsController } from '../../modules/webhook/webhook-events.controller';
import { WebhookEventsService } from '../../modules/webhook/webhook-events.service';
import { RepoAccessService } from '../../modules/repositories/repo-access.service';

// Cover admin listing plus repo-scoped detail/replay authorization for the webhook debug center. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
describe('Webhook events API', () => {
  const req = { user: { id: 'u1', username: 'tester', roles: [] } } as any;
  const adminReq = { user: { id: 'admin-1', username: 'admin', roles: ['admin'] } } as any;

  test('lists global webhook events for admins', async () => {
    const webhookEventsService = {
      listGlobalEvents: jest.fn().mockResolvedValue({ events: [], nextCursor: undefined }),
      getEvent: jest.fn(),
      replayEvent: jest.fn()
    };
    const repoAccessService = {
      isAdmin: jest.fn().mockReturnValue(true),
      requireRepoRead: jest.fn(),
      requireRepoManage: jest.fn()
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookEventsController],
      providers: [
        { provide: WebhookEventsService, useValue: webhookEventsService },
        { provide: RepoAccessService, useValue: repoAccessService }
      ]
    }).compile();
    const controller = moduleRef.get(WebhookEventsController);

    const result = await controller.list(
      adminReq,
      '25',
      'cursor-1',
      'repo-1',
      'github',
      'error',
      'task_creation',
      'evt-root',
      'payload'
    );

    expect(repoAccessService.isAdmin).toHaveBeenCalledWith(adminReq.user);
    expect(webhookEventsService.listGlobalEvents).toHaveBeenCalledWith({
      limit: 25,
      cursor: 'cursor-1',
      repoId: 'repo-1',
      provider: 'github',
      result: 'error',
      errorLayer: 'task_creation',
      replayOfEventId: 'evt-root',
      query: 'payload'
    });
    expect(result).toEqual({ events: [], nextCursor: undefined });
    await moduleRef.close();
  });

  test('rejects global list for non-admin users', async () => {
    const webhookEventsService = {
      listGlobalEvents: jest.fn(),
      getEvent: jest.fn(),
      replayEvent: jest.fn()
    };
    const repoAccessService = {
      isAdmin: jest.fn().mockReturnValue(false),
      requireRepoRead: jest.fn(),
      requireRepoManage: jest.fn()
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookEventsController],
      providers: [
        { provide: WebhookEventsService, useValue: webhookEventsService },
        { provide: RepoAccessService, useValue: repoAccessService }
      ]
    }).compile();
    const controller = moduleRef.get(WebhookEventsController);

    try {
      await controller.list(req, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      throw new Error('expected list to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(403);
    }
    expect(webhookEventsService.listGlobalEvents).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  test('requires repo read permission for non-admin detail lookups', async () => {
    const webhookEventsService = {
      listGlobalEvents: jest.fn(),
      getEvent: jest.fn().mockResolvedValue({ id: 'evt-1', repoId: 'repo-1' }),
      replayEvent: jest.fn()
    };
    const repoAccessService = {
      isAdmin: jest.fn().mockReturnValue(false),
      requireRepoRead: jest.fn().mockResolvedValue(undefined),
      requireRepoManage: jest.fn()
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookEventsController],
      providers: [
        { provide: WebhookEventsService, useValue: webhookEventsService },
        { provide: RepoAccessService, useValue: repoAccessService }
      ]
    }).compile();
    const controller = moduleRef.get(WebhookEventsController);

    const result = await controller.get(req, 'evt-1');

    expect(webhookEventsService.getEvent).toHaveBeenCalledWith('evt-1');
    expect(repoAccessService.requireRepoRead).toHaveBeenCalledWith(req.user, 'repo-1');
    expect(result).toEqual({ event: { id: 'evt-1', repoId: 'repo-1' } });
    await moduleRef.close();
  });

  test('requires repo manage permission for replay dry-run', async () => {
    const webhookEventsService = {
      listGlobalEvents: jest.fn(),
      getEvent: jest.fn().mockResolvedValue({ id: 'evt-1', repoId: 'repo-1' }),
      replayEvent: jest.fn().mockResolvedValue({ id: 'evt-2', repoId: 'repo-1', replayOfEventId: 'evt-1' })
    };
    const repoAccessService = {
      isAdmin: jest.fn().mockReturnValue(false),
      requireRepoRead: jest.fn(),
      requireRepoManage: jest.fn().mockResolvedValue(undefined)
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookEventsController],
      providers: [
        { provide: WebhookEventsService, useValue: webhookEventsService },
        { provide: RepoAccessService, useValue: repoAccessService }
      ]
    }).compile();
    const controller = moduleRef.get(WebhookEventsController);

    const result = await controller.replayDryRun(req, 'evt-1', { mode: 'stored_actions' });

    expect(webhookEventsService.getEvent).toHaveBeenCalledWith('evt-1');
    expect(repoAccessService.requireRepoManage).toHaveBeenCalledWith(req.user, 'repo-1');
    expect(webhookEventsService.replayEvent).toHaveBeenCalledWith(
      'evt-1',
      'u1',
      { mode: 'stored_actions' },
      { dryRun: true }
    );
    expect(result).toEqual({ event: { id: 'evt-2', repoId: 'repo-1', replayOfEventId: 'evt-1' } });
    await moduleRef.close();
  });
});
