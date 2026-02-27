import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { db } from '../../db';
import { generateToken, hashToken } from '../../utils/token';
import { sendMail } from '../../services/mailService';

const getEmailVerifyTtlSeconds = (): number => {
  const raw = Number(process.env.AUTH_EMAIL_VERIFY_TOKEN_TTL_SECONDS ?? 0);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 24 * 60 * 60;
};

const buildVerifyLink = (params: { email: string; token: string }): string => {
  const base = String(process.env.HOOKCODE_CONSOLE_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!base) {
    throw new Error('HOOKCODE_CONSOLE_BASE_URL is required for verification links');
  }
  const url = new URL(`${base}/#/verify-email`);
  url.searchParams.set('email', params.email);
  url.searchParams.set('token', params.token);
  return url.toString();
};

@Injectable()
// Handle email verification token lifecycle for registration. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export class EmailVerificationService {
  async createToken(params: { userId: string; email: string }): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + getEmailVerifyTtlSeconds() * 1000);

    await db.emailVerificationToken.create({
      data: {
        id: randomUUID(),
        userId: params.userId,
        email: params.email,
        emailLower: params.email.toLowerCase(),
        tokenHash,
        expiresAt,
        createdAt: now
      }
    });

    return { token, expiresAt };
  }

  async sendVerificationEmail(params: { email: string; token: string }): Promise<void> {
    const verifyUrl = buildVerifyLink(params);
    await sendMail({
      to: params.email,
      subject: 'Verify your email',
      text: `Verify your email address: ${verifyUrl}`,
      html: `
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      `
    });
  }

  async verifyToken(params: { email: string; token: string }): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
    const tokenHash = hashToken(params.token);
    const row = await db.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, emailLower: true, expiresAt: true, usedAt: true }
    });
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.usedAt) return { ok: false, reason: 'used' };
    if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' };
    if (row.emailLower !== params.email.toLowerCase()) return { ok: false, reason: 'email_mismatch' };

    await db.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() }
      });
      await tx.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() }
      });
    });

    return { ok: true, userId: row.userId };
  }

  ensureVerified(result: { ok: boolean; reason?: string }): void {
    if (result.ok) return;
    throw new BadRequestException({ error: 'Invalid or expired verification token', code: 'EMAIL_VERIFY_INVALID' });
  }
}
