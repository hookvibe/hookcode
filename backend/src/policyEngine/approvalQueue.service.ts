import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../db';
import type { CreatedAtCursor } from '../utils/pagination';
import { encodeCreatedAtCursor } from '../utils/pagination';
import type {
  ApprovalActionRecord,
  ApprovalActionType,
  ApprovalRequestRecord,
  ApprovalRequestStatus,
  ApprovalTaskSummary,
  PolicyEvaluation,
  PolicyRuleConditions
} from './types';

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const actionRowToRecord = (row: any): ApprovalActionRecord => ({
  id: String(row.id),
  approvalRequestId: String(row.approvalRequestId),
  actorUserId: row.actorUserId ? String(row.actorUserId) : undefined,
  action: String(row.action) as ApprovalActionType,
  note: typeof row.note === 'string' ? row.note : undefined,
  createdAt: toIso(row.createdAt),
  meta: isRecord(row.meta) ? row.meta : undefined
});

const approvalRowToRecord = (row: any): ApprovalRequestRecord => ({
  id: String(row.id),
  taskId: String(row.taskId),
  repoId: row.repoId ? String(row.repoId) : undefined,
  robotId: row.robotId ? String(row.robotId) : undefined,
  requestedByUserId: row.requestedByUserId ? String(row.requestedByUserId) : undefined,
  resolvedByUserId: row.resolvedByUserId ? String(row.resolvedByUserId) : undefined,
  status: String(row.status) as ApprovalRequestStatus,
  decision: String(row.decision) as any,
  riskLevel: String(row.riskLevel) as any,
  summary: String(row.summary ?? ''),
  details: isRecord(row.details) ? (row.details as any) : undefined,
  resolvedAt: row.resolvedAt ? toIso(row.resolvedAt) : undefined,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  actions: Array.isArray(row.actions)
    ? row.actions
        .map(actionRowToRecord)
        .sort((a: ApprovalActionRecord, b: ApprovalActionRecord) => a.createdAt.localeCompare(b.createdAt))
    : []
});

export interface ListApprovalRequestsParams {
  limit: number;
  cursor?: CreatedAtCursor | null;
  status?: ApprovalRequestStatus;
  repoId?: string;
  taskId?: string;
  allowedRepoIds?: string[] | null;
}

export interface ApprovalInboxEntry extends ApprovalRequestRecord {
  taskSummary?: ApprovalTaskSummary;
}

export interface ListApprovalRequestsResult {
  approvals: ApprovalInboxEntry[];
  nextCursor?: string;
}

@Injectable()
export class ApprovalQueueService {
  async getApprovalRequest(requestId: string): Promise<ApprovalInboxEntry | null> {
    const row = await db.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        actions: { orderBy: { createdAt: 'asc' } },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            repoId: true,
            robotId: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });
    if (!row) return null;

    const [repo, robot] = await Promise.all([
      row.task?.repoId ? db.repository.findUnique({ where: { id: row.task.repoId }, select: { name: true } }) : Promise.resolve(null),
      row.task?.robotId ? db.repoRobot.findUnique({ where: { id: row.task.robotId }, select: { name: true } }) : Promise.resolve(null)
    ]);

    const request = approvalRowToRecord(row);
    if (!row.task) return request;
    return {
      ...request,
      taskSummary: {
        id: String(row.task.id),
        title: row.task.title ? String(row.task.title) : undefined,
        status: String(row.task.status),
        repoId: row.task.repoId ? String(row.task.repoId) : undefined,
        repoName: repo?.name ? String(repo.name) : undefined,
        robotId: row.task.robotId ? String(row.task.robotId) : undefined,
        robotName: robot?.name ? String(robot.name) : undefined,
        createdAt: toIso(row.task.createdAt),
        updatedAt: toIso(row.task.updatedAt)
      }
    };
  }

  async enqueueApproval(params: {
    taskId: string;
    repoId?: string;
    robotId?: string;
    actorUserId?: string;
    evaluation: PolicyEvaluation;
  }): Promise<void> {
    const now = new Date();
    const existing = await db.approvalRequest.findFirst({
      where: { taskId: params.taskId, status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });

    const details = params.evaluation.details as any;

    if (existing) {
      await db.$transaction([
        db.approvalRequest.update({
          where: { id: existing.id },
          data: {
            summary: params.evaluation.summary,
            decision: params.evaluation.decision,
            riskLevel: params.evaluation.riskLevel,
            details,
            updatedAt: now
          }
        }),
        db.task.update({
          where: { id: params.taskId },
          data: {
            status: 'waiting_approval',
            result: {
              message: params.evaluation.summary,
              policyDecision: params.evaluation.decision,
              policyRiskLevel: params.evaluation.riskLevel
            } as any,
            updatedAt: now
          }
        })
      ]);
      return;
    }

    const requestId = randomUUID();
    await db.$transaction([
      db.approvalRequest.create({
        data: {
          id: requestId,
          taskId: params.taskId,
          repoId: params.repoId ?? null,
          robotId: params.robotId ?? null,
          requestedByUserId: params.actorUserId ?? null,
          resolvedByUserId: null,
          status: 'pending',
          decision: params.evaluation.decision,
          riskLevel: params.evaluation.riskLevel,
          summary: params.evaluation.summary,
          details,
          createdAt: now,
          updatedAt: now
        }
      }),
      db.approvalAction.create({
        data: {
          id: randomUUID(),
          approvalRequestId: requestId,
          actorUserId: params.actorUserId ?? null,
          action: 'requested',
          note: params.evaluation.summary,
          createdAt: now
        }
      }),
      db.task.update({
        where: { id: params.taskId },
        data: {
          status: 'waiting_approval',
          result: {
            message: params.evaluation.summary,
            policyDecision: params.evaluation.decision,
            policyRiskLevel: params.evaluation.riskLevel
          } as any,
          updatedAt: now
        }
      })
    ]);
  }

  async rejectApproval(requestId: string, actorUserId: string, params?: { note?: string; status?: 'rejected' | 'changes_requested' }): Promise<string | null> {
    const current = await db.approvalRequest.findUnique({ where: { id: requestId } });
    if (!current || current.status !== 'pending') return null;

    const now = new Date();
    const nextStatus = params?.status ?? 'rejected';
    const note = params?.note?.trim() || undefined;
    const message = nextStatus === 'changes_requested' ? 'Approval requested changes.' : 'Approval rejected.';

    await db.$transaction([
      db.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          resolvedByUserId: actorUserId,
          resolvedAt: now,
          updatedAt: now
        }
      }),
      db.approvalAction.create({
        data: {
          id: randomUUID(),
          approvalRequestId: requestId,
          actorUserId,
          action: nextStatus === 'changes_requested' ? 'request_changes' : 'reject',
          note: note ?? null,
          createdAt: now
        }
      }),
      db.task.update({
        where: { id: current.taskId },
        data: {
          status: 'failed',
          result: {
            message: note ? `${message} ${note}` : message,
            approvalStatus: nextStatus,
            approvalRejectedReason: note
          } as any,
          updatedAt: now
        }
      })
    ]);

    return String(current.taskId);
  }

  async approveOnce(requestId: string, actorUserId: string, params?: { note?: string; action?: 'approve' | 'approve_once' }): Promise<string | null> {
    const current = await db.approvalRequest.findUnique({ where: { id: requestId } });
    if (!current || current.status !== 'pending') return null;

    const now = new Date();
    const note = params?.note?.trim() || undefined;
    await db.$transaction([
      db.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          resolvedByUserId: actorUserId,
          resolvedAt: now,
          updatedAt: now
        }
      }),
      db.approvalAction.create({
        data: {
          id: randomUUID(),
          approvalRequestId: requestId,
          actorUserId,
          action: params?.action ?? 'approve',
          note: note ?? null,
          createdAt: now
        }
      }),
      db.task.update({
        where: { id: current.taskId },
        data: {
          status: 'queued',
          result: {
            message: 'Approval granted; task returned to queue.',
            approvalStatus: 'approved'
          } as any,
          updatedAt: now
        }
      })
    ]);

    return String(current.taskId);
  }

  async approveAlways(requestId: string, actorUserId: string, params?: { note?: string }): Promise<string | null> {
    const current = await db.approvalRequest.findUnique({ where: { id: requestId } });
    if (!current || current.status !== 'pending') return null;

    const details = isRecord(current.details) ? current.details : {};
    const targetFiles = Array.isArray(details.targetFiles) ? details.targetFiles.filter((item): item is string => typeof item === 'string') : [];
    const commands = Array.isArray(details.commands) ? details.commands.filter((item): item is string => typeof item === 'string') : [];
    const taskSource = typeof details.taskSource === 'string' ? details.taskSource : undefined;
    const provider = typeof details.provider === 'string' ? details.provider : undefined;
    const sandbox = typeof details.sandbox === 'string' ? details.sandbox : undefined;
    const networkAccess = typeof details.networkAccess === 'boolean' ? details.networkAccess : undefined;
    const riskLevel = typeof current.riskLevel === 'string' ? current.riskLevel : undefined;

    const conditions: PolicyRuleConditions = {
      ...(provider ? { providers: [provider] } : {}),
      ...(taskSource ? { taskSources: [taskSource as any] } : {}),
      ...(sandbox === 'read-only' || sandbox === 'workspace-write' ? { sandboxes: [sandbox] } : {}),
      ...(typeof networkAccess === 'boolean' ? { networkAccess } : {}),
      ...(riskLevel ? { riskLevels: [riskLevel as any] } : {}),
      ...(targetFiles.length ? { targetFilePatterns: targetFiles.map((item) => `^${escapeRegex(item)}$`) } : {}),
      ...(commands.length ? { commandPatterns: commands.map((item) => `^${escapeRegex(item)}$`) } : {})
    };

    const now = new Date();
    await db.$transaction([
      db.policyRule.create({
        data: {
          id: randomUUID(),
          repoId: current.repoId ?? null,
          robotId: current.robotId ?? null,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
          name: `Auto-allow from approval ${current.id}`,
          enabled: true,
          priority: 1000,
          action: 'allow',
          conditions: conditions as any,
          createdAt: now,
          updatedAt: now
        }
      }),
      db.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          resolvedByUserId: actorUserId,
          resolvedAt: now,
          updatedAt: now
        }
      }),
      db.approvalAction.create({
        data: {
          id: randomUUID(),
          approvalRequestId: requestId,
          actorUserId,
          action: 'approve_always',
          note: params?.note?.trim() || null,
          createdAt: now
        }
      }),
      db.task.update({
        where: { id: current.taskId },
        data: {
          status: 'queued',
          result: {
            message: 'Approval granted and a matching allow rule was created.',
            approvalStatus: 'approved'
          } as any,
          updatedAt: now
        }
      })
    ]);

    return String(current.taskId);
  }

  async getLatestApprovalsForTaskIds(taskIds: string[]): Promise<Map<string, ApprovalRequestRecord>> {
    const normalized = Array.from(new Set(taskIds.filter(Boolean)));
    if (!normalized.length) return new Map();

    const rows = await db.approvalRequest.findMany({
      where: { taskId: { in: normalized } },
      include: { actions: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }]
    });

    const result = new Map<string, ApprovalRequestRecord>();
    for (const row of rows) {
      const taskId = String(row.taskId);
      if (result.has(taskId)) continue;
      result.set(taskId, approvalRowToRecord(row));
    }
    return result;
  }

  async listApprovalRequests(params: ListApprovalRequestsParams): Promise<ListApprovalRequestsResult> {
    const take = Math.min(Math.max(params.limit || 20, 1), 200);
    const cursor = params.cursor ?? undefined;
    const where: any = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.repoId ? { repoId: params.repoId } : {}),
      ...(params.taskId ? { taskId: params.taskId } : {})
    };

    if (params.allowedRepoIds && !params.repoId) {
      if (params.allowedRepoIds.length === 0) return { approvals: [] };
      where.repoId = { in: params.allowedRepoIds };
    }

    if (cursor) {
      where.AND = [
        {
          OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }]
        }
      ];
    }

    const rows = await db.approvalRequest.findMany({
      where,
      include: {
        actions: { orderBy: { createdAt: 'asc' } },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            repoId: true,
            robotId: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1
    });

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;

    const repoIds = Array.from(new Set(sliced.map((row) => row.task?.repoId).filter(Boolean))) as string[];
    const robotIds = Array.from(new Set(sliced.map((row) => row.task?.robotId).filter(Boolean))) as string[];
    const [repos, robots] = await Promise.all([
      repoIds.length ? db.repository.findMany({ where: { id: { in: repoIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      robotIds.length ? db.repoRobot.findMany({ where: { id: { in: robotIds } }, select: { id: true, name: true } }) : Promise.resolve([])
    ]);

    const repoMap = new Map(repos.map((row) => [String(row.id), String(row.name)]));
    const robotMap = new Map(robots.map((row) => [String(row.id), String(row.name)]));

    const approvals = sliced.map((row) => {
      const request = approvalRowToRecord(row);
      const task = row.task
        ? ({
            id: String(row.task.id),
            title: row.task.title ? String(row.task.title) : undefined,
            status: String(row.task.status),
            repoId: row.task.repoId ? String(row.task.repoId) : undefined,
            repoName: row.task.repoId ? repoMap.get(String(row.task.repoId)) : undefined,
            robotId: row.task.robotId ? String(row.task.robotId) : undefined,
            robotName: row.task.robotId ? robotMap.get(String(row.task.robotId)) : undefined,
            createdAt: toIso(row.task.createdAt),
            updatedAt: toIso(row.task.updatedAt)
          } satisfies ApprovalTaskSummary)
        : undefined;
      return task ? { ...request, taskSummary: task } : request;
    });

    const last = sliced[sliced.length - 1];
    const nextCursor = hasMore && last ? encodeCreatedAtCursor({ id: last.id, createdAt: last.createdAt }) : undefined;
    return nextCursor ? { approvals, nextCursor } : { approvals };
  }
}
