export {};

jest.mock('../../db', () => ({
  pool: {
    connect: jest.fn()
  }
}));

import { EventEmitter } from 'events';
import { pool } from '../../db';
import { isPreferredWorkerPresent, tryAcquirePreferredWorkerLock } from '../../services/workerPriority';

describe('workerPriority（优先 worker 协调）', () => {
  const connect = pool.connect as unknown as jest.Mock;

  type MockClient = EventEmitter & { query: jest.Mock; release: jest.Mock };

  const makeClient = (opts: { query: jest.Mock; release: jest.Mock }): MockClient => {
    const client = new EventEmitter() as MockClient;
    client.query = opts.query;
    client.release = opts.release;
    return client;
  };

  beforeEach(() => {
    connect.mockReset();
  });

  test('tryAcquirePreferredWorkerLock: 获取到锁时返回 handle，release 会解锁并释放连接', async () => {
    const release = jest.fn();
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [] });

    connect.mockResolvedValue(makeClient({ query, release }));

    const handle = await tryAcquirePreferredWorkerLock();
    expect(handle).not.toBeNull();
    expect(release).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_try_advisory_lock'), expect.any(Array));

    await handle!.release();

    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), expect.any(Array));
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('tryAcquirePreferredWorkerLock: 锁连接断开时不会因未处理 error 事件导致进程崩溃', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const release = jest.fn();
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ locked: true }] });
    const client = makeClient({ query, release });

    connect.mockResolvedValue(client);

    const handle = await tryAcquirePreferredWorkerLock();
    expect(handle).not.toBeNull();
    expect(handle!.isLost()).toBe(false);

    const err = new Error('terminating connection due to administrator command');
    expect(() => client.emit('error', err)).not.toThrow();
    expect(handle!.isLost()).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);

    await expect(handle!.release()).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  test('tryAcquirePreferredWorkerLock: 获取不到锁时返回 null，并释放连接', async () => {
    const release = jest.fn();
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ locked: false }] });

    connect.mockResolvedValue(makeClient({ query, release }));

    const handle = await tryAcquirePreferredWorkerLock();
    expect(handle).toBeNull();
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('isPreferredWorkerPresent: 锁可获取表示无优先 worker，应解锁并返回 false', async () => {
    const release = jest.fn();
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [] });

    connect.mockResolvedValue(makeClient({ query, release }));

    await expect(isPreferredWorkerPresent()).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_try_advisory_lock'), expect.any(Array));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), expect.any(Array));
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('isPreferredWorkerPresent: 锁不可获取表示存在优先 worker，应返回 true', async () => {
    const release = jest.fn();
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ locked: false }] });

    connect.mockResolvedValue(makeClient({ query, release }));

    await expect(isPreferredWorkerPresent()).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_try_advisory_lock'), expect.any(Array));
    expect(release).toHaveBeenCalledTimes(1);
  });
});
