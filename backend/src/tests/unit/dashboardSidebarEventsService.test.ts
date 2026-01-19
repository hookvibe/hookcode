import { DashboardSidebarEventsService } from '../../modules/events/dashboard-sidebar-events.service';

// Unit tests for dashboard change notifications (Route A). kxthpiu4eqrmu0c6bboa

describe('DashboardSidebarEventsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('skips DB polling when there are no dashboard subscribers', async () => {
    const eventStream: any = {
      getTopicSubscriberCount: jest.fn().mockReturnValue(0),
      publish: jest.fn()
    };
    const tokenService: any = { computeToken: jest.fn() };
    const service = new DashboardSidebarEventsService(eventStream, tokenService);

    await (service as any).pollOnce();
    expect(tokenService.computeToken).not.toHaveBeenCalled();
    expect(eventStream.publish).not.toHaveBeenCalled();
  });

  test('publishes only when the token changes', async () => {
    const eventStream: any = {
      getTopicSubscriberCount: jest.fn().mockReturnValue(1),
      publish: jest.fn()
    };
    const tokenService: any = {
      computeToken: jest
        .fn()
        .mockResolvedValueOnce({ token: 'a', hasActiveTasks: false })
        .mockResolvedValueOnce({ token: 'a', hasActiveTasks: false })
        .mockResolvedValueOnce({ token: 'b', hasActiveTasks: false })
    };
    const service = new DashboardSidebarEventsService(eventStream, tokenService);

    await (service as any).pollOnce();
    await (service as any).pollOnce();
    await (service as any).pollOnce();

    expect(eventStream.publish).toHaveBeenCalledTimes(2);
    expect(eventStream.publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ topic: 'dashboard', event: 'dashboard.sidebar.changed', data: { token: 'a' } })
    );
    expect(eventStream.publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ topic: 'dashboard', event: 'dashboard.sidebar.changed', data: { token: 'b' } })
    );
  });
});

