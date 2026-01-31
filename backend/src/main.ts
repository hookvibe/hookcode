import { AppModule } from './app.module';
import { bootstrapHttpServer } from './bootstrap';

// Graceful shutdown timeout to ensure fast restart during dev hot-reload. docs/en/developer/plans/devhotfix20260126/task_plan.md devhotfix20260126
const SHUTDOWN_TIMEOUT_MS = 3000;

const run = async () => {
  const handle = await bootstrapHttpServer({ rootModule: AppModule, logTag: '[backend]' });

  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Force exit after timeout to prevent hanging during hot-reload. docs/en/developer/plans/devhotfix20260126/task_plan.md devhotfix20260126
    const forceExitTimer = setTimeout(() => {
      console.warn('[backend] shutdown timed out, forcing exit');
      process.exit(0);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      await handle.stop();
    } catch (err) {
      console.warn('[backend] shutdown error', err);
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(0);
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

run().catch((err) => {
  console.error('[backend] failed to start', err);
  process.exit(1);
});

