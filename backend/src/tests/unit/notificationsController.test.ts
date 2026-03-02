export {};

import { Test } from '@nestjs/testing';
import { NotificationsController } from '../../modules/notifications/notifications.controller';
import { NotificationsService } from '../../modules/notifications/notifications.service';

// Verify notification API wiring for per-user access. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
describe('NotificationsController', () => {
  const buildModule = async () => {
    const notificationsService = {
      listNotifications: jest.fn().mockResolvedValue({ notifications: [] }),
      getUnreadCount: jest.fn().mockResolvedValue(0),
      markAllRead: jest.fn().mockResolvedValue({ updated: 0, readAt: new Date().toISOString() })
    } as any;

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: notificationsService }]
    }).compile();

    return { moduleRef, notificationsService };
  };

  test('lists notifications for current user', async () => {
    const { moduleRef, notificationsService } = await buildModule();
    const ctrl = moduleRef.get(NotificationsController);
    const req = { user: { id: 'u1' } } as any;

    const result = await ctrl.list(req, '5', undefined, undefined);

    expect(result).toEqual({ notifications: [] });
    expect(notificationsService.listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', limit: 5, unreadOnly: false })
    );

    await moduleRef.close();
  });

  test('returns unread count', async () => {
    const { moduleRef, notificationsService } = await buildModule();
    const ctrl = moduleRef.get(NotificationsController);
    const req = { user: { id: 'u2' } } as any;

    await ctrl.unreadCount(req);

    expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('u2');
    await moduleRef.close();
  });

  test('marks all notifications as read', async () => {
    const { moduleRef, notificationsService } = await buildModule();
    const ctrl = moduleRef.get(NotificationsController);
    const req = { user: { id: 'u3' } } as any;

    await ctrl.readAll(req);

    expect(notificationsService.markAllRead).toHaveBeenCalledWith('u3');
    await moduleRef.close();
  });
});
