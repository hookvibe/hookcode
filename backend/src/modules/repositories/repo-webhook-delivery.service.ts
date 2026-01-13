import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import type { RepoProvider } from '../../types/repository';

export type RepoWebhookDeliveryResult = 'accepted' | 'skipped' | 'rejected' | 'error';

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

export interface RepoWebhookDeliverySummary {
  id: string;
  repoId: string;
  provider: RepoProvider;
  eventName?: string;
  deliveryId?: string;
  result: RepoWebhookDeliveryResult;
  httpStatus: number;
  code?: string;
  message?: string;
  taskIds: string[];
  createdAt: string;
}

export interface RepoWebhookDeliveryDetail extends RepoWebhookDeliverySummary {
  payload?: unknown;
  response?: unknown;
}

export interface CreateRepoWebhookDeliveryInput {
  repoId: string;
  provider: RepoProvider;
  eventName?: string | null;
  deliveryId?: string | null;
  result: RepoWebhookDeliveryResult;
  httpStatus: number;
  code?: string | null;
  message?: string | null;
  taskIds?: string[];
  payload?: unknown;
  response?: unknown;
  at?: Date;
}

const recordToSummary = (row: any): RepoWebhookDeliverySummary => ({
  id: String(row.id),
  repoId: String(row.repoId),
  provider: row.provider === 'github' ? 'github' : 'gitlab',
  eventName: row.eventName ?? undefined,
  deliveryId: row.deliveryId ?? undefined,
  result: (row.result as RepoWebhookDeliveryResult) ?? 'error',
  httpStatus: Number(row.httpStatus ?? 0),
  code: row.code ?? undefined,
  message: row.message ?? undefined,
  taskIds: Array.isArray(row.taskIds) ? row.taskIds.map((v: any) => String(v)) : [],
  createdAt: toIso(row.createdAt)
});

const recordToDetail = (row: any): RepoWebhookDeliveryDetail => ({
  ...recordToSummary(row),
  payload: row.payload ?? undefined,
  response: row.response ?? undefined
});

@Injectable()
export class RepoWebhookDeliveryService {
  async createDelivery(input: CreateRepoWebhookDeliveryInput): Promise<RepoWebhookDeliverySummary> {
    const now = input.at ?? new Date();
    const row = await db.repoWebhookDelivery.create({
      data: {
        id: randomUUID(),
        repoId: input.repoId,
        provider: input.provider,
        eventName: input.eventName ?? null,
        deliveryId: input.deliveryId ?? null,
        result: input.result,
        httpStatus: input.httpStatus,
        code: input.code ?? null,
        message: input.message ?? null,
        taskIds: input.taskIds ?? [],
        payload: input.payload as any,
        response: input.response as any,
        createdAt: now
      }
    });
    return recordToSummary(row);
  }

  async listDeliveries(repoId: string, options?: { limit?: number; cursor?: string }): Promise<{ deliveries: RepoWebhookDeliverySummary[]; nextCursor?: string }> {
    const limit = Math.max(1, Math.min(200, Math.floor(options?.limit ?? 50)));
    const cursor = options?.cursor ? String(options.cursor) : '';

    const rows = await db.repoWebhookDelivery.findMany({
      where: { repoId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1
          }
        : {}),
      select: {
        id: true,
        repoId: true,
        provider: true,
        eventName: true,
        deliveryId: true,
        result: true,
        httpStatus: true,
        code: true,
        message: true,
        taskIds: true,
        createdAt: true
      }
    });
    const deliveries = rows.map(recordToSummary);
    const nextCursor = deliveries.length === limit ? deliveries[deliveries.length - 1]?.id : undefined;
    return { deliveries, ...(nextCursor ? { nextCursor } : {}) };
  }

  async getDelivery(repoId: string, deliveryId: string): Promise<RepoWebhookDeliveryDetail | null> {
    const row = await db.repoWebhookDelivery.findFirst({
      where: { id: deliveryId, repoId },
      select: {
        id: true,
        repoId: true,
        provider: true,
        eventName: true,
        deliveryId: true,
        result: true,
        httpStatus: true,
        code: true,
        message: true,
        taskIds: true,
        payload: true,
        response: true,
        createdAt: true
      }
    });
    return row ? recordToDetail(row) : null;
  }
}

