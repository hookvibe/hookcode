import { ForbiddenException, Injectable } from '@nestjs/common';
import { db } from '../../db';

export type RepoRole = 'owner' | 'maintainer' | 'member';

export interface RepoPermissions {
  canRead: boolean;
  canManage: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canManageTasks: boolean;
}

const ROLE_RANK: Record<RepoRole, number> = {
  member: 1,
  maintainer: 2,
  owner: 3
};

const normalizeRole = (value: unknown): RepoRole | null => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'owner' || raw === 'maintainer' || raw === 'member') return raw;
  return null;
};

@Injectable()
// Enforce repo-level RBAC (read/manage/owner) for API calls. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export class RepoAccessService {
  isAdmin(user?: { roles?: string[] }): boolean {
    return Boolean(user?.roles?.includes('admin'));
  }

  async getRepoRole(userId: string, repoId: string): Promise<RepoRole | null> {
    const row = await db.repoMember.findUnique({
      where: { repoId_userId: { repoId, userId } },
      select: { role: true }
    });
    return normalizeRole(row?.role);
  }

  buildRepoPermissions(role: RepoRole | null, isAdmin: boolean): RepoPermissions {
    // Centralize repo permission flags for API responses. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (isAdmin) {
      return { canRead: true, canManage: true, canDelete: true, canManageMembers: true, canManageTasks: true };
    }
    const rank = role ? ROLE_RANK[role] : 0;
    return {
      canRead: rank > 0,
      canManage: rank >= ROLE_RANK.maintainer,
      canDelete: rank >= ROLE_RANK.owner,
      canManageMembers: rank >= ROLE_RANK.maintainer,
      canManageTasks: rank >= ROLE_RANK.maintainer
    };
  }

  async requireRepoRead(user: { id: string; roles?: string[] }, repoId: string): Promise<RepoRole> {
    if (this.isAdmin(user)) return 'owner';
    const role = await this.getRepoRole(user.id, repoId);
    if (!role) {
      throw new ForbiddenException({ error: 'Forbidden', code: 'REPO_ACCESS_DENIED' });
    }
    return role;
  }

  async requireRepoManage(user: { id: string; roles?: string[] }, repoId: string): Promise<RepoRole> {
    if (this.isAdmin(user)) return 'owner';
    const role = await this.getRepoRole(user.id, repoId);
    if (!role || ROLE_RANK[role] < ROLE_RANK.maintainer) {
      throw new ForbiddenException({ error: 'Forbidden', code: 'REPO_MANAGE_REQUIRED' });
    }
    return role;
  }

  async requireRepoOwner(user: { id: string; roles?: string[] }, repoId: string): Promise<RepoRole> {
    if (this.isAdmin(user)) return 'owner';
    const role = await this.getRepoRole(user.id, repoId);
    if (role !== 'owner') {
      throw new ForbiddenException({ error: 'Forbidden', code: 'REPO_OWNER_REQUIRED' });
    }
    return role;
  }

  async listAccessibleRepoIds(user: { id: string; roles?: string[] }): Promise<string[] | null> {
    if (this.isAdmin(user)) return null;
    const rows = await db.repoMember.findMany({
      where: { userId: user.id },
      select: { repoId: true }
    });
    return rows.map((row) => String(row.repoId));
  }
}
