import { buildNotificationLinkUrl } from '../../modules/notifications/notification-links';

// Verify notification links prefer in-app task hashes and preserve absolute external URLs only as fallback. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
describe('buildNotificationLinkUrl', () => {
  test('builds a task-detail hash when a task id is present', () => {
    expect(buildNotificationLinkUrl({ taskId: 'task-1', externalUrl: 'https://example.com/comment/1' })).toBe('#/tasks/task-1');
  });

  test('keeps an absolute external URL when no in-app task target exists', () => {
    expect(buildNotificationLinkUrl({ externalUrl: 'https://example.com/comment/1' })).toBe('https://example.com/comment/1');
  });

  test('drops unsupported external URLs', () => {
    expect(buildNotificationLinkUrl({ externalUrl: 'javascript:alert(1)' })).toBeUndefined();
  });
});
