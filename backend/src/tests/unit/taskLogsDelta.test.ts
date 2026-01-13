import { computeTaskLogsDelta } from '../../services/taskLogs';

describe('taskLogs.computeTaskLogsDelta', () => {
  test('appends new lines when seq increases and logs grow', () => {
    const delta = computeTaskLogsDelta({
      seenSeq: 2,
      snapshot: { logs: ['a', 'b', 'c'], seq: 3 }
    });
    expect(delta).toEqual({ type: 'append', nextSeenSeq: 3, lines: ['c'] });
  });

  test('appends new lines when logs are a rolling window (length does not increase)', () => {
    const delta = computeTaskLogsDelta({
      seenSeq: 3,
      snapshot: { logs: ['b', 'c', 'd'], seq: 4 }
    });
    expect(delta).toEqual({ type: 'append', nextSeenSeq: 4, lines: ['d'] });
  });

  test('appends multiple lines when seq jumps within the stored window', () => {
    const delta = computeTaskLogsDelta({
      seenSeq: 4,
      snapshot: { logs: ['d', 'e', 'f'], seq: 6 }
    });
    expect(delta).toEqual({ type: 'append', nextSeenSeq: 6, lines: ['e', 'f'] });
  });

  test('resyncs when the cursor fell behind the stored window', () => {
    const delta = computeTaskLogsDelta({
      seenSeq: 1,
      snapshot: { logs: ['d', 'e', 'f'], seq: 6 }
    });
    expect(delta.type).toBe('resync');
    if (delta.type !== 'resync') throw new Error('expected resync');
    expect(delta.nextSeenSeq).toBe(6);
    expect(delta.logs).toEqual(['d', 'e', 'f']);
  });

  test('does not rewind when DB seq is behind (in-memory streaming ahead)', () => {
    const delta = computeTaskLogsDelta({
      seenSeq: 10,
      snapshot: { logs: ['h', 'i', 'j'], seq: 8 }
    });
    expect(delta).toEqual({ type: 'noop', nextSeenSeq: 10 });
  });

  test('treats empty logs + seq=0 as a reset signal', () => {
    const delta = computeTaskLogsDelta({
      seenSeq: 10,
      snapshot: { logs: [], seq: 0 }
    });
    expect(delta).toEqual({ type: 'resync', nextSeenSeq: 0, logs: [] });
  });
});

