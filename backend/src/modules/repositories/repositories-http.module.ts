import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesModule } from './repositories.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [RepositoriesModule, UsersModule],
  controllers: [RepositoriesController]
})
export class RepositoriesHttpModule {}
