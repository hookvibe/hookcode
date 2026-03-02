import { TaskService } from '../../modules/tasks/task.service';

// Validate task-group SSE publishing for per-user updates. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
describe('TaskService task-group SSE', () => {
  test('publishes refresh events with de-duplicated recipients', async () => {
    const eventStream = { publish: jest.fn() };
    const logWriter = { logSystem: jest.fn().mockResolvedValue(undefined) };
    const notificationRecipients = {
      resolveRecipientsForTask: jest.fn().mockResolvedValue(['u1', 'u1', 'u2'])
    };

    const service = new TaskService(eventStream as any, logWriter as any, notificationRecipients as any);
    const task = {
      id: 't1',
      groupId: 'g1',
      status: 'queued',
      updatedAt: '2026-03-02T00:00:00.000Z',
      repoId: 'r1',
      actorUserId: 'u1',
      payload: {}
    } as any;

    await (service as any).emitTaskGroupUpdate(task, 'created');

    expect(notificationRecipients.resolveRecipientsForTask).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: 'r1', actorUserId: 'u1' })
    );
    expect(eventStream.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'task-group:g1',
        event: 'task-group.refresh',
        userIds: ['u1', 'u2'],
        data: expect.objectContaining({ groupId: 'g1', taskId: 't1', reason: 'created' })
      })
    );
    expect(logWriter.logSystem).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TASK_GROUP_UPDATE_PUSHED', taskGroupId: 'g1' })
    );
  });

  test('skips publishing when no recipients are resolved', async () => {
    const eventStream = { publish: jest.fn() };
    const logWriter = { logSystem: jest.fn().mockResolvedValue(undefined) };
    const notificationRecipients = {
      resolveRecipientsForTask: jest.fn().mockResolvedValue([])
    };

    const service = new TaskService(eventStream as any, logWriter as any, notificationRecipients as any);
    const task = {
      id: 't2',
      groupId: 'g2',
      status: 'queued',
      updatedAt: '2026-03-02T00:00:00.000Z',
      repoId: 'r2',
      actorUserId: 'u2',
      payload: {}
    } as any;

    await (service as any).emitTaskGroupUpdate(task, 'status');

    expect(eventStream.publish).not.toHaveBeenCalled();
    expect(logWriter.logSystem).not.toHaveBeenCalled();
  });
});
