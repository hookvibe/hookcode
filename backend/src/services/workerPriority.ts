import { pool } from '../db';

const LOCK_KEY_1 = 1095323215; // 'AICO'
const LOCK_KEY_2 = 1464811595; // 'WORK'

type LockRow = { locked: boolean };

export interface PreferredWorkerLockHandle {
  release: () => Promise<void>;
  isLost: () => boolean;
}

/**
 * Acquire the "preferred worker" lock (PG advisory lock).
 * - Used when local dev and production share the same database, so the local worker can have priority to consume tasks.
 * - This lock is session-scoped: it only stays held as long as the same PG connection remains open.
 */
export const tryAcquirePreferredWorkerLock = async (): Promise<PreferredWorkerLockHandle | null> => {
  const client = await pool.connect();
  const state = { lost: false, released: false };

  const onClientEndOrError = (err?: unknown) => {
    state.lost = true;
    console.warn('[workerPriority] preferred worker lock connection lost; lock is no longer held', err);
    if (state.released) return;
    state.released = true;
    try {
      client.removeListener('error', onError);
      client.removeListener('end', onEnd);
    } catch (_) {
      // ignore
    }
    try {
      // Mark the connection as errored and remove it from the pool (avoid reusing a bad connection).
      client.release(err instanceof Error ? err : true);
    } catch (_) {
      // ignore
    }
  };

  const onError = (err: unknown) => onClientEndOrError(err);
  const onEnd = () => onClientEndOrError();

  client.on('error', onError);
  client.on('end', onEnd);
  try {
    const { rows } = await client.query<LockRow>('SELECT pg_try_advisory_lock($1, $2) AS locked', [
      LOCK_KEY_1,
      LOCK_KEY_2
    ]);
    const locked = Boolean(rows?.[0]?.locked);
    if (!locked) {
      if (!state.released) {
        state.released = true;
        try {
          client.removeListener('error', onError);
          client.removeListener('end', onEnd);
        } catch (_) {
          // ignore
        }
        client.release();
      }
      return null;
    }

    return {
      release: async () => {
        if (state.released) return;
        state.released = true;
        try {
          try {
            client.removeListener('error', onError);
            client.removeListener('end', onEnd);
          } catch (_) {
            // ignore
          }
          if (!state.lost) {
            await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_KEY_1, LOCK_KEY_2]);
          }
        } finally {
          client.release();
        }
      },
      isLost: () => state.lost
    };
  } catch (err) {
    if (!state.released) {
      state.released = true;
      try {
        client.removeListener('error', onError);
        client.removeListener('end', onEnd);
      } catch (_) {
        // ignore
      }
      client.release();
    }
    throw err;
  }
};

/**
 * Detect whether a "preferred worker" exists.
 * - By trying to acquire the same advisory lock: if it can't be acquired, another worker holds it (i.e. preferred worker exists).
 */
export const isPreferredWorkerPresent = async (): Promise<boolean> => {
  const client = await pool.connect();
  let hadError = false;
  const onError = (err: unknown) => {
    hadError = true;
    console.warn('[workerPriority] preferred worker detect connection error', err);
  };
  client.on('error', onError);
  try {
    const { rows } = await client.query<LockRow>('SELECT pg_try_advisory_lock($1, $2) AS locked', [
      LOCK_KEY_1,
      LOCK_KEY_2
    ]);
    const locked = Boolean(rows?.[0]?.locked);
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_KEY_1, LOCK_KEY_2]);
      return false;
    }
    return true;
  } finally {
    try {
      client.release(hadError ? true : undefined);
    } finally {
      try {
        client.removeListener('error', onError);
      } catch (_) {
        // ignore
      }
    }
  }
};
