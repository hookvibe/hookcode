export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  // Include email context for auth responses. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  email?: string;
  emailVerifiedAt?: string;
  roles: string[];
}

export abstract class AuthUserLoader {
  abstract loadUser(userId: string): Promise<AuthUser | null>;
}
