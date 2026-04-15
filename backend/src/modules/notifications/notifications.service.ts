import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import type { CreatedAtCursor } from '../../utils/pagination';
import { encodeCreatedAtCursor } from '../../utils/pagination';
import type { NotificationEntry, NotificationLevel, NotificationType } from '../../types/notification';
import { EventStreamService } from '../events/event-stream.service';
import { LogWriterService } from '../logs/log-writer.service';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  level: NotificationLevel;
  message: string;
  code?: string;
  repoId?: string;
  taskId?: string;
  taskGroupId?: string;
  linkUrl?: string; // Persist the primary notification destination so producers can hand the UI one canonical target. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
  meta?: unknown;
}

export interface ListNotificationsParams {
  userId: string;
  limit: number;
  cursor?: CreatedAtCursor | null;
  unreadOnly?: boolean;
}

export interface ListNotificationsResult {
  notifications: NotificationEntry[];
  nextCursor?: string;
}

@Injectable()
// Persist user notifications and fan them out via SSE. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export class NotificationsService {
  constructor(
    private readonly eventStream: EventStreamService,
    private readonly logWriter: LogWriterService
  ) {}

  async createNotification(input: CreateNotificationInput): Promise<NotificationEntry> {
    const row = await db.notification.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        level: input.level,
        message: input.message,
        code: input.code ?? null,
        repoId: input.repoId ?? null,
        taskId: input.taskId ?? null,
        taskGroupId: input.taskGroupId ?? null,
        linkUrl: input.linkUrl ?? null,
        meta: input.meta === undefined ? undefined : (input.meta as any)
      }
    });

    const entry = this.toEntry(row);
    this.eventStream.publish({ topic: 'notifications', event: 'notification', data: entry, userIds: [entry.userId] });

    // Emit an audit log entry for notification creation. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    void this.logWriter.logSystem({
      level: 'info',
      message: 'Notification created',
      code: 'NOTIFICATION_CREATED',
      actorUserId: entry.userId,
      repoId: entry.repoId,
      taskId: entry.taskId,
      taskGroupId: entry.taskGroupId,
      meta: { notificationId: entry.id, type: entry.type, hasLink: Boolean(entry.linkUrl) } // Record link presence without logging raw URLs. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
    });

    return entry;
  }

  async listNotifications(params: ListNotificationsParams): Promise<ListNotificationsResult> {
    const take = Math.min(Math.max(params.limit || 20, 1), 200);
    const cursor = params.cursor ?? undefined;

    const where: any = {
      userId: params.userId,
      ...(params.unreadOnly ? { readAt: null } : null)
    };

    if (cursor) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } }
          ]
        }
      ];
    }

    const rows = await db.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1
    });

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const notifications = sliced.map((row) => this.toEntry(row));
    const last = sliced[sliced.length - 1];
    const nextCursor = hasMore && last ? encodeCreatedAtCursor({ id: last.id, createdAt: last.createdAt }) : undefined;

    return { notifications, ...(nextCursor ? { nextCursor } : {}) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await db.notification.count({ where: { userId, readAt: null } });
    return Number(count ?? 0);
  }

  async markAllRead(userId: string): Promise<{ updated: number; readAt: string }> {
    const now = new Date();
    const result = await db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now }
    });

    const readAt = now.toISOString();
    this.eventStream.publish({
      topic: 'notifications',
      event: 'notifications.read_all',
      data: { readAt },
      userIds: [userId]
    });

    // Emit audit log entry for read-all operations. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    void this.logWriter.logSystem({
      level: 'info',
      message: 'Notifications marked read',
      code: 'NOTIFICATION_READ_ALL',
      actorUserId: userId,
      meta: { updated: Number(result.count ?? 0) }
    });

    return { updated: Number(result.count ?? 0), readAt };
  }

  private toEntry(row: any): NotificationEntry {
    return {
      id: String(row.id),
      userId: String(row.userId),
      type: row.type,
      level: row.level,
      message: row.message,
      code: row.code ?? undefined,
      repoId: row.repoId ?? undefined,
      taskId: row.taskId ?? undefined,
      taskGroupId: row.taskGroupId ?? undefined,
      linkUrl: row.linkUrl ?? undefined,
      meta: row.meta ?? undefined,
      readAt: row.readAt ? (row.readAt instanceof Date ? row.readAt.toISOString() : String(row.readAt)) : undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
    };
  }
}
