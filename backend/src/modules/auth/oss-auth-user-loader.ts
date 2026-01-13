import { Injectable } from '@nestjs/common';
import { UserService } from '../users/user.service';
import { AuthUserLoader, type AuthUser } from './auth-user-loader';

@Injectable()
export class OssAuthUserLoader implements AuthUserLoader {
  constructor(private readonly userService: UserService) {}

  async loadUser(userId: string): Promise<AuthUser | null> {
    const user = await this.userService.getById(userId);
    if (!user || user.disabled) return null;

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: []
    };
  }
}
