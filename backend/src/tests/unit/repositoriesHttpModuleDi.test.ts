import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { RepositoriesHttpModule } from '../../modules/repositories/repositories-http.module';

describe('RepositoriesHttpModule DI', () => {
  test('can boot without missing providers', async () => {
    const app = await NestFactory.create(RepositoriesHttpModule, { logger: false });
    await app.init();
    await app.close();
  });
});

