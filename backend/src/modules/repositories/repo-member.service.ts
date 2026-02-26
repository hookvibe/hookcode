import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { db } from '../../db';
import { generateToken, hashToken } from '../../utils/token';
import { sendMail } from '../../services/mailService';
import { UserService } from '../users/user.service';

export type RepoMemberRole = 'owner' | 'maintainer' | 'member';

export interface RepoMemberSummary {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  email?: string;
  role: RepoMemberRole;
  createdAt: string;
  updatedAt: string;
}

export interface RepoInviteSummary {
  id: string;
  repoId: string;
  email: string;
  role: RepoMemberRole;
  invitedByUserId: string;
  invitedUserId?: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

const normalizeRole = (value: unknown): RepoMemberRole => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'owner' || raw === 'maintainer' || raw === 'member') return raw;
  throw new Error('role must be owner, maintainer, or member');
};

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const toInviteSummary = (row: {
  id: string;
  repoId: string;
  email: string;
  role: string;
  invitedByUserId: string;
  invitedUserId: string | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): RepoInviteSummary => ({
  id: String(row.id),
  repoId: String(row.repoId),
  email: String(row.email),
  role: normalizeRole(row.role),
  invitedByUserId: String(row.invitedByUserId),
  invitedUserId: row.invitedUserId ? String(row.invitedUserId) : undefined,
  acceptedAt: row.acceptedAt ? toIso(row.acceptedAt) : null,
  revokedAt: row.revokedAt ? toIso(row.revokedAt) : null,
  expiresAt: toIso(row.expiresAt),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

const buildInviteLink = (params: { email: string; token: string }): string => {
  const base = String(process.env.HOOKCODE_CONSOLE_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!base) {
    throw new Error('HOOKCODE_CONSOLE_BASE_URL is required for invite links');
  }
  const url = new URL(`${base}/#/accept-invite`);
  url.searchParams.set('email', params.email);
  url.searchParams.set('token', params.token);
  return url.toString();
};

@Injectable()
// Handle repo member CRUD + invite flows for RBAC. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export class RepoMemberService {
  constructor(private readonly userService: UserService) {}

  async listMembers(repoId: string): Promise<RepoMemberSummary[]> {
    const rows = await db.repoMember.findMany({
      where: { repoId },
      include: { user: { select: { id: true, username: true, displayName: true, email: true } } }
    });
    return rows.map((row) => ({
      id: String(row.id),
      userId: String(row.userId),
      username: String(row.user.username),
      displayName: row.user.displayName ?? undefined,
      email: row.user.email ?? undefined,
      role: normalizeRole(row.role),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt)
    }));
  }

  async listInvites(repoId: string): Promise<RepoInviteSummary[]> {
    const rows = await db.repoMemberInvite.findMany({ where: { repoId } });
    return rows.map((row) => toInviteSummary(row));
  }

  async addMember(params: { repoId: string; userId: string; role: RepoMemberRole }): Promise<void> {
    await db.repoMember.upsert({
      where: { repoId_userId: { repoId: params.repoId, userId: params.userId } },
      update: { role: params.role, updatedAt: new Date() },
      create: {
        id: randomUUID(),
        repoId: params.repoId,
        userId: params.userId,
        role: params.role,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async updateMemberRole(params: { repoId: string; userId: string; role: RepoMemberRole }): Promise<void> {
    const existing = await db.repoMember.findUnique({
      where: { repoId_userId: { repoId: params.repoId, userId: params.userId } }
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Member not found' });
    }
    await db.repoMember.update({
      where: { id: existing.id },
      data: { role: params.role, updatedAt: new Date() }
    });
  }

  async removeMember(params: { repoId: string; userId: string }): Promise<void> {
    await db.repoMember.deleteMany({
      where: { repoId: params.repoId, userId: params.userId }
    });
  }

  async createInvite(params: { repoId: string; invitedByUserId: string; email: string; role: RepoMemberRole }): Promise<RepoInviteSummary> {
    const email = String(params.email ?? '').trim();
    if (!email) throw new BadRequestException({ error: 'email is required' });
    const emailLower = email.toLowerCase();
    const existingUser = await this.userService.getByEmail(email);
    if (existingUser) {
      const membership = await db.repoMember.findUnique({
        where: { repoId_userId: { repoId: params.repoId, userId: existingUser.id } }
      });
      if (membership) {
        throw new BadRequestException({ error: 'user is already a member' });
      }
    }

    const pending = await db.repoMemberInvite.findFirst({
      where: {
        repoId: params.repoId,
        emailLower,
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (pending) {
      throw new BadRequestException({ error: 'invite already sent' });
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invite = await db.repoMemberInvite.create({
      data: {
        id: randomUUID(),
        repoId: params.repoId,
        email,
        emailLower,
        role: params.role,
        tokenHash,
        invitedByUserId: params.invitedByUserId,
        invitedUserId: existingUser?.id ?? null,
        expiresAt,
        createdAt: now,
        updatedAt: now
      }
    });

    const inviteUrl = buildInviteLink({ email, token });
    await sendMail({
      to: email,
      subject: 'You have been invited to a repository',
      text: `Accept the invite: ${inviteUrl}`,
      html: `
        <p>You have been invited to join a repository.</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      `
    });

    return toInviteSummary(invite);
  }

  async acceptInvite(params: { token: string; email: string; userId: string }): Promise<string> {
    const tokenHash = hashToken(params.token);
    const emailLower = params.email.toLowerCase();
    const invite = await db.repoMemberInvite.findFirst({
      where: { tokenHash },
      select: { id: true, repoId: true, role: true, emailLower: true, acceptedAt: true, revokedAt: true, expiresAt: true }
    });
    if (!invite) throw new BadRequestException({ error: 'Invalid invite token' });
    if (invite.acceptedAt || invite.revokedAt) throw new BadRequestException({ error: 'Invite is no longer active' });
    if (invite.expiresAt.getTime() <= Date.now()) throw new BadRequestException({ error: 'Invite has expired' });
    if (invite.emailLower !== emailLower) throw new BadRequestException({ error: 'Invite email mismatch' });

    await db.$transaction(async (tx) => {
      await tx.repoMemberInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), invitedUserId: params.userId, updatedAt: new Date() }
      });
      await tx.repoMember.upsert({
        where: { repoId_userId: { repoId: invite.repoId, userId: params.userId } },
        update: { role: normalizeRole(invite.role), updatedAt: new Date() },
        create: {
          id: randomUUID(),
          repoId: invite.repoId,
          userId: params.userId,
          role: normalizeRole(invite.role),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    });

    return invite.repoId;
  }

  async revokeInvite(params: { repoId: string; inviteId: string }): Promise<void> {
    const existing = await db.repoMemberInvite.findUnique({ where: { id: params.inviteId } });
    if (!existing || existing.repoId !== params.repoId) {
      throw new NotFoundException({ error: 'Invite not found' });
    }
    await db.repoMemberInvite.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), updatedAt: new Date() }
    });
  }
}
