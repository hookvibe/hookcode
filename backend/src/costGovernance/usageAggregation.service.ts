import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { normalizeRoutedProviderKey, type RoutedProviderKey } from '../providerRouting/providerRouting.types';
import { estimateCostMicroUsd, getDefaultModelForProvider } from './costRateCard';
import { resolveModelFromProviderConfig } from './executionOverride';
import type {
  CostBreakdownResponse,
  CostSummaryResponse,
  CostTaskItem,
  UsageBreakdownItem,
  UsageSeriesPoint
} from './types';
import {
  isRecord,
  microUsdToUsd,
  normalizeBudgetQuotaEventType,
  normalizeBudgetExecutionOverride,
  toIso
} from './types';

type TaskUsageRow = {
  id: string;
  title?: string | null;
  status: string;
  repoId?: string | null;
  robotId?: string | null;
  actorUserId?: string | null;
  result?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type RepoMeta = { id: string; name: string };
type RobotMeta = { id: string; name: string; modelProvider: string; modelProviderConfig: unknown };
type UserMeta = { id: string; displayName?: string | null; username: string };

type TaskUsageSample = {
  taskId: string;
  title?: string;
  status: string;
  repoId?: string;
  repoName?: string;
  robotId?: string;
  robotName?: string;
  actorUserId?: string;
  actorUserName?: string;
  provider?: RoutedProviderKey;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicroUsd: bigint;
  createdAt: string;
  updatedAt: string;
};

const MAX_SUMMARY_TASKS = 5_000;
const MAX_BREAKDOWN_TASKS = 10_000;

const getDayBucket = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

const getMonthBucketDate = (value: Date): Date => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
const getDayBucketDate = (value: Date): Date => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const resolveDateRange = (days: number): { startAt: Date; endAt: Date } => {
  const normalizedDays = Number.isFinite(days) ? Math.max(1, Math.min(365, Math.floor(days))) : 30;
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - (normalizedDays - 1) * 86_400_000);
  startAt.setUTCHours(0, 0, 0, 0);
  return { startAt, endAt };
};

const toTaskItem = (sample: TaskUsageSample): CostTaskItem => ({
  taskId: sample.taskId,
  title: sample.title,
  status: sample.status,
  repoId: sample.repoId,
  repoName: sample.repoName,
  robotId: sample.robotId,
  robotName: sample.robotName,
  actorUserId: sample.actorUserId,
  actorUserName: sample.actorUserName,
  provider: sample.provider,
  model: sample.model,
  totalTokens: sample.totalTokens,
  estimatedCostUsd: microUsdToUsd(sample.estimatedCostMicroUsd) ?? 0,
  createdAt: sample.createdAt
});

const compareCostDesc = (a: TaskUsageSample, b: TaskUsageSample): number => {
  if (a.estimatedCostMicroUsd === b.estimatedCostMicroUsd) return b.createdAt.localeCompare(a.createdAt);
  return a.estimatedCostMicroUsd > b.estimatedCostMicroUsd ? -1 : 1;
};

const pickActorName = (user?: UserMeta): string | undefined => {
  if (!user) return undefined;
  const displayName = String(user.displayName ?? '').trim();
  return displayName || user.username;
};

const parseTokenUsage = (result: unknown): { inputTokens: number; outputTokens: number; totalTokens: number } => {
  if (!isRecord(result) || !isRecord(result.tokenUsage)) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  const inputTokens = Number(result.tokenUsage.inputTokens);
  const outputTokens = Number(result.tokenUsage.outputTokens);
  const totalTokens = Number(result.tokenUsage.totalTokens);

  return {
    inputTokens: Number.isFinite(inputTokens) && inputTokens > 0 ? Math.floor(inputTokens) : 0,
    outputTokens: Number.isFinite(outputTokens) && outputTokens > 0 ? Math.floor(outputTokens) : 0,
    totalTokens: Number.isFinite(totalTokens) && totalTokens > 0 ? Math.floor(totalTokens) : 0
  };
};

const resolveTaskProviderAndModel = (params: {
  result: unknown;
  robot?: RobotMeta;
}): { provider?: RoutedProviderKey; model?: string } => {
  const result = isRecord(params.result) ? params.result : {};
  const costGovernance = isRecord(result.costGovernance) ? result.costGovernance : {};
  const executionOverride = normalizeBudgetExecutionOverride(costGovernance.executionOverride);
  const providerRouting = isRecord(result.providerRouting) ? result.providerRouting : {};

  const provider =
    executionOverride?.provider ??
    normalizeRoutedProviderKey(providerRouting.finalProvider) ??
    normalizeRoutedProviderKey(providerRouting.selectedProvider) ??
    normalizeRoutedProviderKey(params.robot?.modelProvider);

  if (!provider) return {};

  const model =
    executionOverride?.model ||
    (params.robot && normalizeRoutedProviderKey(params.robot.modelProvider) === provider
      ? resolveModelFromProviderConfig(provider, params.robot.modelProviderConfig)
      : undefined) ||
    getDefaultModelForProvider(provider);

  return { provider, model };
};

const buildBreakdownItems = (
  grouped: Map<string, { label: string; taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>,
  limit: number
): UsageBreakdownItem[] =>
  Array.from(grouped.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      taskCount: value.taskCount,
      failedTaskCount: value.failedTaskCount,
      totalTokens: value.totalTokens,
      estimatedCostUsd: microUsdToUsd(value.estimatedCostMicroUsd) ?? 0
    }))
    .sort((a, b) => {
      if (a.estimatedCostUsd === b.estimatedCostUsd) return b.taskCount - a.taskCount;
      return b.estimatedCostUsd - a.estimatedCostUsd;
    })
    .slice(0, Math.max(1, Math.min(limit, 50)));

@Injectable()
export class UsageAggregationService {
  private async loadTasks(filters: {
    startAt: Date;
    endAt: Date;
    repoId?: string;
    robotId?: string;
    actorUserId?: string;
    allowedRepoIds?: string[] | null;
    excludeTaskId?: string;
    take?: number;
  }): Promise<TaskUsageRow[]> {
    if (Array.isArray(filters.allowedRepoIds) && filters.allowedRepoIds.length === 0) return [];

    return db.task.findMany({
      where: {
        archivedAt: null,
        createdAt: {
          gte: filters.startAt,
          lte: filters.endAt
        },
        ...(filters.repoId ? { repoId: filters.repoId } : {}),
        ...(filters.robotId ? { robotId: filters.robotId } : {}),
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
        ...(filters.excludeTaskId ? { id: { not: filters.excludeTaskId } } : {}),
        ...(filters.allowedRepoIds === null ? {} : filters.allowedRepoIds ? { repoId: { in: filters.allowedRepoIds } } : {})
      },
      select: {
        id: true,
        title: true,
        status: true,
        repoId: true,
        robotId: true,
        actorUserId: true,
        result: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(filters.take ?? MAX_BREAKDOWN_TASKS, MAX_BREAKDOWN_TASKS))
    });
  }

  private async loadMaps(tasks: TaskUsageRow[]): Promise<{
    repoMap: Map<string, RepoMeta>;
    robotMap: Map<string, RobotMeta>;
    userMap: Map<string, UserMeta>;
  }> {
    const repoIds = Array.from(new Set(tasks.map((task) => String(task.repoId ?? '').trim()).filter(Boolean)));
    const robotIds = Array.from(new Set(tasks.map((task) => String(task.robotId ?? '').trim()).filter(Boolean)));
    const userIds = Array.from(new Set(tasks.map((task) => String(task.actorUserId ?? '').trim()).filter(Boolean)));

    const [repos, robots, users] = await Promise.all([
      repoIds.length
        ? db.repository.findMany({ where: { id: { in: repoIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      robotIds.length
        ? db.repoRobot.findMany({
            where: { id: { in: robotIds } },
            select: { id: true, name: true, modelProvider: true, modelProviderConfig: true }
          })
        : Promise.resolve([]),
      userIds.length
        ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, username: true } })
        : Promise.resolve([])
    ]);

    return {
      repoMap: new Map(repos.map((repo) => [String(repo.id), { id: String(repo.id), name: String(repo.name) }])),
      robotMap: new Map(
        robots.map((robot) => [
          String(robot.id),
          {
            id: String(robot.id),
            name: String(robot.name),
            modelProvider: String(robot.modelProvider),
            modelProviderConfig: robot.modelProviderConfig
          }
        ])
      ),
      userMap: new Map(
        users.map((user) => [
          String(user.id),
          {
            id: String(user.id),
            displayName: user.displayName ? String(user.displayName) : undefined,
            username: String(user.username)
          }
        ])
      )
    };
  }

  private buildSamples(tasks: TaskUsageRow[], maps: { repoMap: Map<string, RepoMeta>; robotMap: Map<string, RobotMeta>; userMap: Map<string, UserMeta> }): TaskUsageSample[] {
    return tasks.map((task) => {
      const repoId = task.repoId ? String(task.repoId) : undefined;
      const robotId = task.robotId ? String(task.robotId) : undefined;
      const actorUserId = task.actorUserId ? String(task.actorUserId) : undefined;
      const repo = repoId ? maps.repoMap.get(repoId) : undefined;
      const robot = robotId ? maps.robotMap.get(robotId) : undefined;
      const user = actorUserId ? maps.userMap.get(actorUserId) : undefined;
      const tokens = parseTokenUsage(task.result);
      const providerAndModel = resolveTaskProviderAndModel({ result: task.result, robot });
      const estimatedCostMicroUsd =
        providerAndModel.provider && tokens.totalTokens > 0
          ? estimateCostMicroUsd({
              provider: providerAndModel.provider,
              model: providerAndModel.model,
              inputTokens: tokens.inputTokens,
              outputTokens: tokens.outputTokens
            })
          : 0n;

      return {
        taskId: String(task.id),
        title: task.title ? String(task.title) : undefined,
        status: String(task.status),
        repoId,
        repoName: repo?.name,
        robotId,
        robotName: robot?.name,
        actorUserId,
        actorUserName: pickActorName(user),
        provider: providerAndModel.provider,
        model: providerAndModel.model,
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        totalTokens: tokens.totalTokens,
        estimatedCostMicroUsd,
        createdAt: toIso(task.createdAt),
        updatedAt: toIso(task.updatedAt)
      };
    });
  }

  async getScopeUsageSnapshot(params: {
    scopeType: 'user' | 'repo' | 'robot';
    scopeId: string;
    startAt: Date;
    endAt: Date;
    excludeTaskId?: string;
  }): Promise<{ taskCount: number; inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostMicroUsd: bigint }> {
    const tasks = await this.loadTasks({
      startAt: params.startAt,
      endAt: params.endAt,
      ...(params.scopeType === 'user' ? { actorUserId: params.scopeId } : {}),
      ...(params.scopeType === 'repo' ? { repoId: params.scopeId } : {}),
      ...(params.scopeType === 'robot' ? { robotId: params.scopeId } : {}),
      excludeTaskId: params.excludeTaskId,
      take: MAX_BREAKDOWN_TASKS
    });
    const maps = await this.loadMaps(tasks);
    const samples = this.buildSamples(tasks, maps);

    return samples.reduce(
      (acc, sample) => {
        acc.taskCount += 1;
        acc.inputTokens += sample.inputTokens;
        acc.outputTokens += sample.outputTokens;
        acc.totalTokens += sample.totalTokens;
        acc.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
        return acc;
      },
      {
        taskCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicroUsd: 0n
      }
    );
  }

  async syncTaskRollups(taskId: string): Promise<void> {
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        status: true,
        repoId: true,
        robotId: true,
        actorUserId: true,
        result: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!task) return;
    if (task.status !== 'succeeded' && task.status !== 'failed' && task.status !== 'commented') return;

    const maps = await this.loadMaps([task as any]);
    const sample = this.buildSamples([task as any], maps)[0];
    if (!sample) return;

    const now = new Date();
    const bucketDate = getDayBucketDate(task.createdAt);
    const bucketMonth = getMonthBucketDate(task.createdAt);
    const durationMs = Math.max(0, task.updatedAt.getTime() - task.createdAt.getTime());
    const common = {
      taskId: sample.taskId,
      repoId: sample.repoId ?? null,
      robotId: sample.robotId ?? null,
      actorUserId: sample.actorUserId ?? null,
      provider: sample.provider ?? null,
      model: sample.model ?? null,
      status: sample.status,
      taskCount: 1,
      inputTokens: sample.inputTokens,
      outputTokens: sample.outputTokens,
      totalTokens: sample.totalTokens,
      estimatedCostMicroUsd: sample.estimatedCostMicroUsd,
      durationMs,
      failed: sample.status === 'failed',
      updatedAt: now
    };

    await db.usageDailyRollup.upsert({
      where: { taskId: sample.taskId },
      create: {
        id: randomUUID(),
        bucketDate,
        createdAt: now,
        ...common
      },
      update: {
        bucketDate,
        ...common
      }
    });

    await db.usageMonthlyRollup.upsert({
      where: { taskId: sample.taskId },
      create: {
        id: randomUUID(),
        bucketMonth,
        createdAt: now,
        ...common
      },
      update: {
        bucketMonth,
        ...common
      }
    });
  }

  async clearTaskRollups(taskId: string): Promise<void> {
    await Promise.all([
      db.usageDailyRollup.deleteMany({ where: { taskId } }),
      db.usageMonthlyRollup.deleteMany({ where: { taskId } })
    ]);
  }

  async getCostSummary(params: {
    days?: number;
    repoId?: string;
    robotId?: string;
    actorUserId?: string;
    allowedRepoIds?: string[] | null;
  }): Promise<CostSummaryResponse> {
    const { startAt, endAt } = resolveDateRange(params.days ?? 30);
    const tasks = await this.loadTasks({
      startAt,
      endAt,
      repoId: params.repoId,
      robotId: params.robotId,
      actorUserId: params.actorUserId,
      allowedRepoIds: params.allowedRepoIds,
      take: MAX_SUMMARY_TASKS
    });
    const maps = await this.loadMaps(tasks);
    const samples = this.buildSamples(tasks, maps);

    const summary = {
      taskCount: 0,
      failedTaskCount: 0,
      blockedTaskCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0
    };

    const providerBreakdown = new Map<string, { label: string; taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>();
    const repoBreakdown = new Map<string, { label: string; taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>();
    const robotBreakdown = new Map<string, { label: string; taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>();
    const userBreakdown = new Map<string, { label: string; taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>();
    const seriesMap = new Map<string, { taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>();

    for (const sample of samples) {
      summary.taskCount += 1;
      if (sample.status === 'failed') summary.failedTaskCount += 1;
      summary.inputTokens += sample.inputTokens;
      summary.outputTokens += sample.outputTokens;
      summary.totalTokens += sample.totalTokens;
      summary.estimatedCostUsd += microUsdToUsd(sample.estimatedCostMicroUsd) ?? 0;

      const providerKey = sample.provider ?? 'unknown';
      const providerItem = providerBreakdown.get(providerKey) ?? {
        label: providerKey,
        taskCount: 0,
        failedTaskCount: 0,
        totalTokens: 0,
        estimatedCostMicroUsd: 0n
      };
      providerItem.taskCount += 1;
      providerItem.failedTaskCount += sample.status === 'failed' ? 1 : 0;
      providerItem.totalTokens += sample.totalTokens;
      providerItem.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
      providerBreakdown.set(providerKey, providerItem);

      if (sample.repoId) {
        const repoItem = repoBreakdown.get(sample.repoId) ?? {
          label: sample.repoName || sample.repoId,
          taskCount: 0,
          failedTaskCount: 0,
          totalTokens: 0,
          estimatedCostMicroUsd: 0n
        };
        repoItem.taskCount += 1;
        repoItem.failedTaskCount += sample.status === 'failed' ? 1 : 0;
        repoItem.totalTokens += sample.totalTokens;
        repoItem.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
        repoBreakdown.set(sample.repoId, repoItem);
      }

      if (sample.robotId) {
        const robotItem = robotBreakdown.get(sample.robotId) ?? {
          label: sample.robotName || sample.robotId,
          taskCount: 0,
          failedTaskCount: 0,
          totalTokens: 0,
          estimatedCostMicroUsd: 0n
        };
        robotItem.taskCount += 1;
        robotItem.failedTaskCount += sample.status === 'failed' ? 1 : 0;
        robotItem.totalTokens += sample.totalTokens;
        robotItem.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
        robotBreakdown.set(sample.robotId, robotItem);
      }

      if (sample.actorUserId) {
        const userItem = userBreakdown.get(sample.actorUserId) ?? {
          label: sample.actorUserName || sample.actorUserId,
          taskCount: 0,
          failedTaskCount: 0,
          totalTokens: 0,
          estimatedCostMicroUsd: 0n
        };
        userItem.taskCount += 1;
        userItem.failedTaskCount += sample.status === 'failed' ? 1 : 0;
        userItem.totalTokens += sample.totalTokens;
        userItem.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
        userBreakdown.set(sample.actorUserId, userItem);
      }

      const bucket = getDayBucket(sample.createdAt);
      const seriesItem = seriesMap.get(bucket) ?? {
        taskCount: 0,
        failedTaskCount: 0,
        totalTokens: 0,
        estimatedCostMicroUsd: 0n
      };
      seriesItem.taskCount += 1;
      seriesItem.failedTaskCount += sample.status === 'failed' ? 1 : 0;
      seriesItem.totalTokens += sample.totalTokens;
      seriesItem.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
      seriesMap.set(bucket, seriesItem);
    }

    const quotaEventWhere = {
      createdAt: { gte: startAt, lte: endAt },
      ...(params.repoId ? { repoId: params.repoId } : {}),
      ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
      ...(params.allowedRepoIds === null
        ? {}
        : params.allowedRepoIds?.length
          ? { OR: [{ repoId: { in: params.allowedRepoIds } }, { repoId: null }] }
          : { repoId: null })
    } as const;

    const [blockedTaskCount, recentQuotaEventsRows] = await Promise.all([
      db.quotaEvent.count({
        where: {
          ...quotaEventWhere,
          eventType: 'blocked'
        }
      }),
      db.quotaEvent.findMany({
        where: quotaEventWhere,
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);
    summary.blockedTaskCount = blockedTaskCount;

    const series: UsageSeriesPoint[] = Array.from(seriesMap.entries())
      .map(([bucket, value]) => ({
        bucket,
        taskCount: value.taskCount,
        failedTaskCount: value.failedTaskCount,
        totalTokens: value.totalTokens,
        estimatedCostUsd: microUsdToUsd(value.estimatedCostMicroUsd) ?? 0
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    return {
      window: {
        days: Math.max(1, Math.min(365, Math.floor(params.days ?? 30))),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString()
      },
      summary,
      series,
      providers: buildBreakdownItems(providerBreakdown, 10),
      topRepos: buildBreakdownItems(repoBreakdown, 10),
      topRobots: buildBreakdownItems(robotBreakdown, 10),
      topUsers: buildBreakdownItems(userBreakdown, 10),
      topTasks: [...samples].sort(compareCostDesc).slice(0, 10).map(toTaskItem),
      failedCostTasks: [...samples]
        .filter((sample) => sample.status === 'failed' && (sample.estimatedCostMicroUsd > 0n || sample.totalTokens > 0))
        .sort(compareCostDesc)
        .slice(0, 10)
        .map(toTaskItem),
      recentQuotaEvents: recentQuotaEventsRows.map((row) => ({
        id: String(row.id),
        budgetPolicyId: row.budgetPolicyId ? String(row.budgetPolicyId) : undefined,
        taskId: row.taskId ? String(row.taskId) : undefined,
        repoId: row.repoId ? String(row.repoId) : undefined,
        robotId: row.robotId ? String(row.robotId) : undefined,
        actorUserId: row.actorUserId ? String(row.actorUserId) : undefined,
        scopeType: row.scopeType ? (String(row.scopeType) as any) : undefined,
        scopeId: row.scopeId ? String(row.scopeId) : undefined,
        eventType: normalizeBudgetQuotaEventType(row.eventType),
        decision: row.decision as any,
        message: String(row.message),
        details: isRecord(row.details) ? row.details : undefined,
        createdAt: toIso(row.createdAt)
      }))
    };
  }

  async getRepoBreakdown(params: {
    days?: number;
    actorUserId?: string;
    allowedRepoIds?: string[] | null;
  }): Promise<CostBreakdownResponse> {
    const { startAt, endAt } = resolveDateRange(params.days ?? 30);
    const tasks = await this.loadTasks({
      startAt,
      endAt,
      actorUserId: params.actorUserId,
      allowedRepoIds: params.allowedRepoIds,
      take: MAX_BREAKDOWN_TASKS
    });
    const maps = await this.loadMaps(tasks);
    const samples = this.buildSamples(tasks, maps);
    const repoBreakdown = new Map<string, { label: string; taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>();

    for (const sample of samples) {
      if (!sample.repoId) continue;
      const item = repoBreakdown.get(sample.repoId) ?? {
        label: sample.repoName || sample.repoId,
        taskCount: 0,
        failedTaskCount: 0,
        totalTokens: 0,
        estimatedCostMicroUsd: 0n
      };
      item.taskCount += 1;
      item.failedTaskCount += sample.status === 'failed' ? 1 : 0;
      item.totalTokens += sample.totalTokens;
      item.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
      repoBreakdown.set(sample.repoId, item);
    }

    return {
      window: {
        days: Math.max(1, Math.min(365, Math.floor(params.days ?? 30))),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString()
      },
      items: buildBreakdownItems(repoBreakdown, 50)
    };
  }

  async getRobotBreakdown(params: {
    days?: number;
    repoId?: string;
    actorUserId?: string;
    allowedRepoIds?: string[] | null;
  }): Promise<CostBreakdownResponse> {
    const { startAt, endAt } = resolveDateRange(params.days ?? 30);
    const tasks = await this.loadTasks({
      startAt,
      endAt,
      repoId: params.repoId,
      actorUserId: params.actorUserId,
      allowedRepoIds: params.allowedRepoIds,
      take: MAX_BREAKDOWN_TASKS
    });
    const maps = await this.loadMaps(tasks);
    const samples = this.buildSamples(tasks, maps);
    const robotBreakdown = new Map<string, { label: string; taskCount: number; failedTaskCount: number; totalTokens: number; estimatedCostMicroUsd: bigint }>();

    for (const sample of samples) {
      if (!sample.robotId) continue;
      const item = robotBreakdown.get(sample.robotId) ?? {
        label: sample.robotName || sample.robotId,
        taskCount: 0,
        failedTaskCount: 0,
        totalTokens: 0,
        estimatedCostMicroUsd: 0n
      };
      item.taskCount += 1;
      item.failedTaskCount += sample.status === 'failed' ? 1 : 0;
      item.totalTokens += sample.totalTokens;
      item.estimatedCostMicroUsd += sample.estimatedCostMicroUsd;
      robotBreakdown.set(sample.robotId, item);
    }

    return {
      window: {
        days: Math.max(1, Math.min(365, Math.floor(params.days ?? 30))),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString()
      },
      items: buildBreakdownItems(robotBreakdown, 50)
    };
  }
}
