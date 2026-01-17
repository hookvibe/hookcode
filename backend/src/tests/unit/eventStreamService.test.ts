import { EventStreamService } from '../../modules/events/event-stream.service';

// Unit tests for the reusable SSE event hub. kxthpiu4eqrmu0c6bboa

describe('EventStreamService', () => {
  test('publishes events to matching topic subscribers', () => {
    const service = new EventStreamService();
    const resDashboard: any = { write: jest.fn() };
    const resAll: any = { write: jest.fn() };

    const unsubscribeDashboard = service.subscribe(resDashboard, { topics: ['dashboard'] });
    const unsubscribeAll = service.subscribe(resAll);

    service.publish({ topic: 'dashboard', event: 'dashboard.sidebar.changed', data: { token: 't' } });
    expect(resDashboard.write).toHaveBeenCalledWith(expect.stringContaining('event: dashboard.sidebar.changed'));
    expect(resAll.write).toHaveBeenCalledWith(expect.stringContaining('event: dashboard.sidebar.changed'));

    resDashboard.write.mockClear();
    resAll.write.mockClear();
    service.publish({ topic: 'repos', event: 'repos.changed', data: { ok: true } });
    expect(resDashboard.write).not.toHaveBeenCalled();
    expect(resAll.write).toHaveBeenCalledWith(expect.stringContaining('event: repos.changed'));

    unsubscribeDashboard();
    unsubscribeAll();
  });

  test('drops broken subscribers on write errors', () => {
    const service = new EventStreamService();
    const resBroken: any = { write: jest.fn(() => {
      throw new Error('broken');
    }) };

    service.subscribe(resBroken, { topics: ['dashboard'] });
    expect(() => service.publish({ topic: 'dashboard', event: 'dashboard.sidebar.changed', data: { token: 't' } })).not.toThrow();
    expect(service.getTopicSubscriberCount('dashboard')).toBe(0);
  });
});

