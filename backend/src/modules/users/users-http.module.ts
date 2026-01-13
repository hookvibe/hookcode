import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersModule } from './users.module';

@Module({
  imports: [UsersModule],
  controllers: [UsersController]
})
export class UsersHttpModule {}

