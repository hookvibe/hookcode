export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  roles: string[];
}

export abstract class AuthUserLoader {
  abstract loadUser(userId: string): Promise<AuthUser | null>;
}

