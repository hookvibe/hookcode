import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserApiTokenService } from './user-api-token.service';

@Module({
  // Expose PAT token service to auth/user HTTP modules. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
  providers: [UserService, UserApiTokenService],
  exports: [UserService, UserApiTokenService]
})
export class UsersModule {}
