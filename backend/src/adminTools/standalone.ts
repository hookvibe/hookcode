import 'reflect-metadata';

import dotenv from 'dotenv';
import { verifyToken } from '../auth/authService';
import { closeDb, db } from '../db';
import { startAdminTools } from './startAdminTools';

dotenv.config();

const run = async () => {
  const handle = await startAdminTools({
    authDeps: {
      verifyToken,
      getUserById: async (id: string) => {
        const user = await db.user.findUnique({ where: { id } });
        if (!user) return null;
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName ?? undefined,
          disabled: user.disabled
        };
      }
    }
  });

  if (!handle) return;

  const shutdown = async () => {
    try {
      await handle.stop();
    } finally {
      await closeDb();
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

run().catch((err) => {
  console.error('[admin-tools] failed to start', err);
  process.exit(1);
});
