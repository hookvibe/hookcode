import { PreviewLogStream } from '../../modules/tasks/preview-log-stream.service';
import type { PreviewLogEntry } from '../../modules/tasks/preview.types';

// Unit tests for preview log SSE fan-out. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as

describe('PreviewLogStream', () => {
  test('publishes entries to matching subscribers', () => {
    const stream = new PreviewLogStream();
    const key = PreviewLogStream.buildInstanceKey('group-1', 'frontend');
    const listener = jest.fn();
    const unsubscribe = stream.subscribe(key, listener);

    const entry: PreviewLogEntry = {
      timestamp: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      level: 'stdout',
      message: 'ready'
    };

    stream.publish(key, entry);
    expect(listener).toHaveBeenCalledWith({ entry });

    unsubscribe();
  });

  test('isolates subscribers by instance key', () => {
    const stream = new PreviewLogStream();
    const keyA = PreviewLogStream.buildInstanceKey('group-1', 'frontend');
    const keyB = PreviewLogStream.buildInstanceKey('group-1', 'admin');
    const listenerA = jest.fn();
    const listenerB = jest.fn();

    stream.subscribe(keyA, listenerA);
    stream.subscribe(keyB, listenerB);

    stream.publish(keyA, {
      timestamp: new Date('2026-01-02T00:00:00.000Z').toISOString(),
      level: 'system',
      message: 'boot'
    });

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
  });
});
