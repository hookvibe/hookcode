import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AuthController]
})
export class AuthHttpModule {}

