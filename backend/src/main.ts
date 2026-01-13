import { AppModule } from './app.module';
import { bootstrapHttpServer } from './bootstrap';

const run = async () => {
  const handle = await bootstrapHttpServer({ rootModule: AppModule, logTag: '[backend]' });

  const shutdown = async () => {
    await handle.stop();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

run().catch((err) => {
  console.error('[backend] failed to start', err);
  process.exit(1);
});

