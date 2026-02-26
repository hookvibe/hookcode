import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthGuard } from './auth.guard';
import { AuthUserLoader } from './auth-user-loader';
import { EmailVerificationService } from './email-verification.service';
import { OssAuthUserLoader } from './oss-auth-user-loader';

@Module({
  imports: [UsersModule],
  providers: [
    OssAuthUserLoader,
    { provide: AuthUserLoader, useExisting: OssAuthUserLoader },
    { provide: APP_GUARD, useClass: AuthGuard },
    // Provide email verification helpers for auth flows. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    EmailVerificationService
  ],
  exports: [AuthUserLoader, EmailVerificationService]
})
export class AuthModule {}
