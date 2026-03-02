jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    repoMember: { findUnique: jest.fn(), findMany: jest.fn() }
  }
}));

import { db } from '../../db';
import { NotificationRecipientService } from '../../modules/notifications/notification-recipient.service';

// Validate notification recipient matching rules avoid display-name collisions. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
describe('NotificationRecipientService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resolveActorUserIdFromPayload ignores display name candidates', async () => {
    const userService = { getRecordByLogin: jest.fn() } as any;
    const service = new NotificationRecipientService(userService);

    const result = await service.resolveActorUserIdFromPayload('repo-1', {
      sender: { name: 'Admin User' },
      user: { name: 'Admin User' },
      user_name: 'Admin User'
    });

    expect(result).toBeNull();
    expect(userService.getRecordByLogin).not.toHaveBeenCalled();
    expect(db.repoMember.findUnique).not.toHaveBeenCalled();
  });

  test('resolveActorUserIdFromPayload matches login candidates', async () => {
    const userService = { getRecordByLogin: jest.fn() } as any;
    const service = new NotificationRecipientService(userService);
    (userService.getRecordByLogin as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (db.repoMember.findUnique as jest.Mock).mockResolvedValue({ id: 'member-1' });

    const result = await service.resolveActorUserIdFromPayload('repo-1', {
      sender: { login: 'octocat' }
    });

    expect(result).toBe('user-1');
    expect(userService.getRecordByLogin).toHaveBeenCalledWith('octocat');
    expect(db.repoMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { repoId_userId: { repoId: 'repo-1', userId: 'user-1' } },
        select: { id: true }
      })
    );
  });
});
