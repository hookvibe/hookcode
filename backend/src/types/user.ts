export interface User {
  id: string;
  username: string;
  // Include email + roles in user DTOs for RBAC and verification. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  email?: string;
  displayName?: string;
  emailVerifiedAt?: string;
  roles: string[];
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}
