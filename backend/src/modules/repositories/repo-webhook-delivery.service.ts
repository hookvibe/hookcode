import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import type { RepoProvider } from '../../types/repository';
import type { WebhookDebugTrace, WebhookDryRunResult, WebhookErrorLayer, WebhookReplayMode } from '../webhook/webhook-debug';

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
  mappedEventType?: string;
  deliveryId?: string;
  result: RepoWebhookDeliveryResult;
  httpStatus: number;
  code?: string;
  message?: string;
  payloadHash?: string;
  signatureVerified?: boolean;
  errorLayer?: WebhookErrorLayer;
  matchedRuleIds: string[];
  matchedRobotIds: string[];
  taskIds: string[];
  taskGroupIds: string[];
  replayOfEventId?: string;
  replayMode?: WebhookReplayMode;
  createdAt: string;
}

export interface RepoWebhookDeliveryDetail extends RepoWebhookDeliverySummary {
  payload?: unknown;
  response?: unknown;
  debugTrace?: WebhookDebugTrace;
  dryRunResult?: WebhookDryRunResult;
  replays?: RepoWebhookDeliverySummary[];
}

export interface CreateRepoWebhookDeliveryInput {
  repoId: string;
  provider: RepoProvider;
  eventName?: string | null;
  mappedEventType?: string | null;
  deliveryId?: string | null;
  result: RepoWebhookDeliveryResult;
  httpStatus: number;
  code?: string | null;
  message?: string | null;
  payloadHash?: string | null;
  signatureVerified?: boolean | null;
  errorLayer?: WebhookErrorLayer | null;
  matchedRuleIds?: string[];
  matchedRobotIds?: string[];
  taskIds?: string[];
  taskGroupIds?: string[];
  replayOfEventId?: string | null;
  replayMode?: WebhookReplayMode | null;
  payload?: unknown;
  response?: unknown;
  debugTrace?: WebhookDebugTrace;
  dryRunResult?: WebhookDryRunResult;
  at?: Date;
}

export interface RepoWebhookDeliveryListOptions {
  limit?: number;
  cursor?: string;
  result?: RepoWebhookDeliveryResult;
}

export interface GlobalWebhookEventListOptions extends RepoWebhookDeliveryListOptions {
  repoId?: string;
  provider?: RepoProvider;
  errorLayer?: WebhookErrorLayer;
  replayOfEventId?: string;
  query?: string;
}

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item)) : []);

const recordToSummary = (row: any): RepoWebhookDeliverySummary => ({
  id: String(row.id),
  repoId: String(row.repoId),
  provider: row.provider === 'github' ? 'github' : 'gitlab',
  eventName: row.eventName ?? undefined,
  mappedEventType: row.mappedEventType ?? undefined,
  deliveryId: row.deliveryId ?? undefined,
  result: (row.result as RepoWebhookDeliveryResult) ?? 'error',
  httpStatus: Number(row.httpStatus ?? 0),
  code: row.code ?? undefined,
  message: row.message ?? undefined,
  payloadHash: row.payloadHash ?? undefined,
  signatureVerified: typeof row.signatureVerified === 'boolean' ? row.signatureVerified : undefined,
  errorLayer: row.errorLayer ?? undefined,
  matchedRuleIds: toStringArray(row.matchedRuleIds),
  matchedRobotIds: toStringArray(row.matchedRobotIds),
  taskIds: toStringArray(row.taskIds),
  taskGroupIds: toStringArray(row.taskGroupIds),
  replayOfEventId: row.replayOfEventId ?? undefined,
  replayMode: row.replayMode ?? undefined,
  createdAt: toIso(row.createdAt)
});

const recordToDetail = (row: any, replays?: RepoWebhookDeliverySummary[]): RepoWebhookDeliveryDetail => ({
  ...recordToSummary(row),
  payload: row.payload ?? undefined,
  response: row.response ?? undefined,
  debugTrace: (row.debugTrace as WebhookDebugTrace | null | undefined) ?? undefined,
  dryRunResult: (row.dryRunResult as WebhookDryRunResult | null | undefined) ?? undefined,
  replays
});

const SUMMARY_SELECT = {
  id: true,
  repoId: true,
  provider: true,
  eventName: true,
  mappedEventType: true,
  deliveryId: true,
  result: true,
  httpStatus: true,
  code: true,
  message: true,
  payloadHash: true,
  signatureVerified: true,
  errorLayer: true,
  matchedRuleIds: true,
  matchedRobotIds: true,
  taskIds: true,
  taskGroupIds: true,
  replayOfEventId: true,
  replayMode: true,
  createdAt: true
} as const;

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  payload: true,
  response: true,
  debugTrace: true,
  dryRunResult: true
} as const;

const buildWhere = (options?: GlobalWebhookEventListOptions & { repoId?: string }) => {
  const query = typeof options?.query === 'string' ? options.query.trim() : '';
  return {
    ...(options?.repoId ? { repoId: options.repoId } : {}),
    ...(options?.result ? { result: options.result } : {}),
    ...(options?.provider ? { provider: options.provider } : {}),
    ...(options?.errorLayer ? { errorLayer: options.errorLayer } : {}),
    ...(options?.replayOfEventId ? { replayOfEventId: options.replayOfEventId } : {}),
    ...(query
      ? {
          OR: [
            { eventName: { contains: query, mode: 'insensitive' as const } },
            { mappedEventType: { contains: query, mode: 'insensitive' as const } },
            { deliveryId: { contains: query, mode: 'insensitive' as const } },
            { code: { contains: query, mode: 'insensitive' as const } },
            { message: { contains: query, mode: 'insensitive' as const } },
            { payloadHash: { contains: query, mode: 'insensitive' as const } }
          ]
        }
      : {})
  };
};

// Treat repo webhook deliveries as the canonical event store for replay/debug tooling. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
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
        mappedEventType: input.mappedEventType ?? null,
        deliveryId: input.deliveryId ?? null,
        result: input.result,
        httpStatus: input.httpStatus,
        code: input.code ?? null,
        message: input.message ?? null,
        payloadHash: input.payloadHash ?? null,
        signatureVerified: input.signatureVerified ?? null,
        errorLayer: input.errorLayer ?? null,
        matchedRuleIds: input.matchedRuleIds ?? [],
        matchedRobotIds: input.matchedRobotIds ?? [],
        taskIds: input.taskIds ?? [],
        taskGroupIds: input.taskGroupIds ?? [],
        replayOfEventId: input.replayOfEventId ?? null,
        replayMode: input.replayMode ?? null,
        payload: input.payload as any,
        response: input.response as any,
        debugTrace: input.debugTrace as any,
        dryRunResult: input.dryRunResult as any,
        createdAt: now
      },
      select: SUMMARY_SELECT
    });
    return recordToSummary(row);
  }

  async listDeliveries(repoId: string, options?: RepoWebhookDeliveryListOptions): Promise<{ deliveries: RepoWebhookDeliverySummary[]; nextCursor?: string }> {
    return this.listMany({
      repoId,
      limit: options?.limit,
      cursor: options?.cursor,
      result: options?.result
    });
  }

  async listGlobalEvents(options?: GlobalWebhookEventListOptions): Promise<{ events: RepoWebhookDeliverySummary[]; nextCursor?: string }> {
    const data = await this.listMany(options);
    return {
      events: data.deliveries,
      nextCursor: data.nextCursor
    };
  }

  async getDelivery(repoId: string, deliveryId: string): Promise<RepoWebhookDeliveryDetail | null> {
    const row = await db.repoWebhookDelivery.findFirst({
      where: { id: deliveryId, repoId },
      select: DETAIL_SELECT
    });
    if (!row) return null;
    const replays = await this.listReplayChildren(deliveryId);
    return recordToDetail(row, replays);
  }

  async getDeliveryById(deliveryId: string): Promise<RepoWebhookDeliveryDetail | null> {
    const row = await db.repoWebhookDelivery.findUnique({
      where: { id: deliveryId },
      select: DETAIL_SELECT
    });
    if (!row) return null;
    const replays = await this.listReplayChildren(deliveryId);
    return recordToDetail(row, replays);
  }

  private async listMany(options?: GlobalWebhookEventListOptions & { repoId?: string }): Promise<{ deliveries: RepoWebhookDeliverySummary[]; nextCursor?: string }> {
    const limit = Math.max(1, Math.min(200, Math.floor(options?.limit ?? 50)));
    const cursor = options?.cursor ? String(options.cursor) : '';

    const rows = await db.repoWebhookDelivery.findMany({
      where: buildWhere(options),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1
          }
        : {}),
      select: SUMMARY_SELECT
    });
    const deliveries = rows.map(recordToSummary);
    const nextCursor = deliveries.length === limit ? deliveries[deliveries.length - 1]?.id : undefined;
    return { deliveries, ...(nextCursor ? { nextCursor } : {}) };
  }

  private async listReplayChildren(deliveryId: string): Promise<RepoWebhookDeliverySummary[]> {
    const rows = await db.repoWebhookDelivery.findMany({
      where: { replayOfEventId: deliveryId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: SUMMARY_SELECT
    });
    return rows.map(recordToSummary);
  }
}
