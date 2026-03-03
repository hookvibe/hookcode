import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { UserService } from '../users/user.service';

const normalizeCandidate = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

@Injectable()
// Resolve notification recipients based on webhook payloads and repo membership. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export class NotificationRecipientService {
  constructor(private readonly userService: UserService) {}

  async resolveActorUserIdFromPayload(repoId: string | undefined, payload: unknown): Promise<string | null> {
    if (!repoId) return null;
    const candidates = this.extractCandidates(payload);
    for (const candidate of candidates) {
      const user = await this.userService.getRecordByLogin(candidate);
      if (!user) continue;
      const isMember = await this.isRepoMember(repoId, user.id);
      if (isMember) return user.id;
    }
    return null;
  }

  async resolveRecipientsForTask(params: {
    repoId?: string;
    actorUserId?: string;
    payload?: unknown;
  }): Promise<string[]> {
    if (params.actorUserId) return [params.actorUserId];

    const repoId = params.repoId;
    if (!repoId) return [];

    const actorUserId = await this.resolveActorUserIdFromPayload(repoId, params.payload);
    if (actorUserId) return [actorUserId];

    // Fall back to the repo owner (creator) when no trigger user is found. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    return this.listRepoOwnerUserIds(repoId);
  }

  private async isRepoMember(repoId: string, userId: string): Promise<boolean> {
    const row = await db.repoMember.findUnique({ where: { repoId_userId: { repoId, userId } }, select: { id: true } });
    return Boolean(row?.id);
  }

  private async listRepoOwnerUserIds(repoId: string): Promise<string[]> {
    const rows = await db.repoMember.findMany({
      // Use repo owners as creator recipients for fallback notifications. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      where: { repoId, role: 'owner' },
      select: { userId: true }
    });
    return rows.map((row) => String(row.userId));
  }

  private extractCandidates(payload: unknown): string[] {
    const p: any = payload ?? {};
    const candidates = new Set<string>();

    const push = (value: unknown) => {
      const candidate = normalizeCandidate(value);
      if (candidate) candidates.add(candidate);
    };

    // Avoid display-name candidates to prevent accidental account matches. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    // GitHub sender/commenter/user identities. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    push(p?.sender?.login);
    push(p?.sender?.email);
    push(p?.comment?.user?.login);
    push(p?.comment?.user?.email);
    push(p?.issue?.user?.login);
    push(p?.pull_request?.user?.login);

    // GitLab user identities. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    push(p?.user?.username);
    push(p?.user?.email);
    push(p?.user_username);
    push(p?.user_email);

    return Array.from(candidates);
  }
}
