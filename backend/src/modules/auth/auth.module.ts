import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthGuard } from './auth.guard';
import { AuthUserLoader } from './auth-user-loader';
import { OssAuthUserLoader } from './oss-auth-user-loader';

@Module({
  imports: [UsersModule],
  providers: [
    OssAuthUserLoader,
    { provide: AuthUserLoader, useExisting: OssAuthUserLoader },
    { provide: APP_GUARD, useClass: AuthGuard }
  ],
  exports: [AuthUserLoader]
})
export class AuthModule {}
