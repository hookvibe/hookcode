import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { db } from '../../db';
import type { RepoRobot, RobotPermission, RobotDefaultBranchRole } from '../../types/repoRobot';
import type { RobotDependencyConfig } from '../../types/dependency';
import type { TimeWindow } from '../../types/timeWindow';
import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { normalizeRepoWorkflowMode } from '../../services/repoWorkflowMode';
import {
  buildTimeWindow,
  mergeModelProviderConfig,
  normalizeDefaultBranch,
  normalizeDefaultBranchRole,
  normalizeDependencyConfig,
  normalizeLanguage,
  normalizeModelProvider,
  normalizePermission,
  normalizeRobotName,
  normalizeSharedRobotConfig,
  toIso,
  toPublicModelProviderConfig
} from './robot-config.shared';

const normalizeRepoCredentialSource = (value: unknown): 'robot' | 'user' | 'repo' | 'global' | undefined => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'robot' || raw === 'user' || raw === 'repo' || raw === 'global') return raw;
  return undefined;
};

const normalizeRepoCredentialRemark = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw : null;
};

const recordToRobot = (row: any): RepoRobot => ({
  // Mark repo-owned robots explicitly so mixed-scope APIs can label the source without inferring from context. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  scope: 'repo',
  id: String(row.id),
  repoId: String(row.repoId),
  name: String(row.name),
  permission: normalizePermission(String(row.permission)),
  hasToken: Boolean((typeof row.token === 'string' ? row.token : '').trim()),
  // Change record: expose explicit repo credential source + remark for multi-profile selection UX.
  repoCredentialSource: row.repoCredentialSource ?? undefined,
  repoCredentialRemark: row.repoCredentialRemark ?? undefined,
  repoCredentialProfileId: row.repoCredentialProfileId ?? undefined,
  cloneUsername: row.cloneUsername ?? undefined,
  // Surface default worker bindings so repo settings can route new tasks to a chosen executor. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  defaultWorkerId: row.defaultWorkerId ?? undefined,
  repoTokenUserId: row.repoTokenUserId ?? undefined,
  repoTokenUsername: row.repoTokenUsername ?? undefined,
  repoTokenUserName: row.repoTokenUserName ?? undefined,
  repoTokenUserEmail: row.repoTokenUserEmail ?? undefined,
  repoTokenRepoRole: row.repoTokenRepoRole ?? undefined,
  repoTokenRepoRoleDetails: row.repoTokenRepoRoleJson ?? undefined,
  promptDefault: row.promptDefault ?? undefined,
  language: normalizeLanguage(row.language),
  modelProvider: row.modelProvider ? String(row.modelProvider) : CODEX_PROVIDER_KEY,
  modelProviderConfig: toPublicModelProviderConfig(row.modelProvider ? String(row.modelProvider) : CODEX_PROVIDER_KEY, row.modelProviderConfig),
  // Expose robot dependency overrides for execution behavior. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyConfig: row.dependencyConfig ?? undefined,
  defaultBranch: normalizeDefaultBranch(row.defaultBranch),
  defaultBranchRole: normalizeDefaultBranchRole(row.defaultBranchRole),
  // Surface repo workflow mode for UI control and agent enforcement. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  repoWorkflowMode: normalizeRepoWorkflowMode(row.repoWorkflowMode ?? row.repo_workflow_mode) ?? undefined,
  // Surface robot-level time windows for execution scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow: buildTimeWindow(row.timeWindowStartHour, row.timeWindowEndHour),
  activatedAt: row.activatedAt ? toIso(row.activatedAt) : undefined,
  lastTestAt: row.lastTestAt ? toIso(row.lastTestAt) : undefined,
  lastTestOk: row.lastTestOk === null || row.lastTestOk === undefined ? undefined : Boolean(row.lastTestOk),
  lastTestMessage: row.lastTestMessage ?? undefined,
  enabled: Boolean(row.enabled),
  isDefault: Boolean(row.isDefault),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

export interface RepoRobotWithToken extends RepoRobot {
  token?: string;
  modelProviderConfigRaw?: unknown;
}

const recordToRobotWithToken = (row: any): RepoRobotWithToken => ({
  ...recordToRobot(row),
  token: row.token ?? undefined,
  modelProviderConfigRaw: row.modelProviderConfig ?? undefined
});

export interface CreateRepoRobotInput {
  name: string;
  token?: string | null;
  cloneUsername?: string | null;
  defaultWorkerId?: string | null;
  repoCredentialSource?: 'robot' | 'user' | 'repo' | 'global' | string | null;
  repoCredentialProfileId?: string | null;
  repoCredentialRemark?: string | null;
  promptDefault: string;
  language?: string | null;
  modelProvider?: string;
  modelProviderConfig?: unknown;
  dependencyConfig?: RobotDependencyConfig | null;
  defaultBranch?: string | null;
  defaultBranchRole?: RobotDefaultBranchRole | null;
  // Allow explicit workflow mode selection when creating robots. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  repoWorkflowMode?: 'auto' | 'direct' | 'fork' | string | null;
  // Optional hour-level scheduling window for robot executions. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow | null;
  isDefault?: boolean;
}

export interface UpdateRepoRobotInput {
  name?: string;
  token?: string | null;
  cloneUsername?: string | null;
  defaultWorkerId?: string | null;
  repoCredentialSource?: 'robot' | 'user' | 'repo' | 'global' | string | null;
  repoCredentialProfileId?: string | null;
  repoCredentialRemark?: string | null;
  promptDefault?: string;
  language?: string | null;
  modelProvider?: string;
  modelProviderConfig?: unknown;
  dependencyConfig?: RobotDependencyConfig | null;
  defaultBranch?: string | null;
  defaultBranchRole?: RobotDefaultBranchRole | null;
  // Allow explicit workflow mode updates on robots. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  repoWorkflowMode?: 'auto' | 'direct' | 'fork' | string | null;
  // Optional hour-level scheduling window for robot executions. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow | null;
  enabled?: boolean;
  isDefault?: boolean;
}

@Injectable()
export class RepoRobotService {
  async listByRepo(repoId: string): Promise<RepoRobot[]> {
    const rows = await db.repoRobot.findMany({
      where: { repoId },
      orderBy: { createdAt: 'asc' }
    });
    return rows.map(recordToRobot);
  }

  async listByRepoWithToken(repoId: string): Promise<RepoRobotWithToken[]> {
    const rows = await db.repoRobot.findMany({
      where: { repoId },
      orderBy: { createdAt: 'asc' }
    });
    return rows.map(recordToRobotWithToken);
  }

  async getById(id: string): Promise<RepoRobot | null> {
    const row = await db.repoRobot.findUnique({ where: { id } });
    return row ? recordToRobot(row) : null;
  }

  async getByIdWithToken(id: string): Promise<RepoRobotWithToken | null> {
    const row = await db.repoRobot.findUnique({ where: { id } });
    return row ? recordToRobotWithToken(row) : null;
  }

  async createRobot(
    actor: { id: string } | null,
    repoId: string,
    input: CreateRepoRobotInput
  ): Promise<RepoRobot> {
    const id = randomUUID();
    const now = new Date();
    const name = normalizeRobotName(String(input.name ?? ''));
    if (!name) throw new Error('name is required');

    const tokenRaw = input.token === undefined ? null : input.token;
    const token =
      typeof tokenRaw === 'string'
        ? (tokenRaw.trim() ? tokenRaw.trim() : null)
        : tokenRaw;
    const cloneUsername = input.cloneUsername === undefined ? null : input.cloneUsername;
    const repoCredentialProfileIdRaw = input.repoCredentialProfileId === undefined ? null : input.repoCredentialProfileId;
    const repoCredentialProfileId =
      typeof repoCredentialProfileIdRaw === 'string'
        ? (repoCredentialProfileIdRaw.trim() ? repoCredentialProfileIdRaw.trim() : null)
        : repoCredentialProfileIdRaw;
    const explicitSource = normalizeRepoCredentialSource(input.repoCredentialSource);
    const repoCredentialSource = explicitSource ?? (token ? 'robot' : repoCredentialProfileId ? 'user' : 'repo');
    const repoCredentialRemark = normalizeRepoCredentialRemark(input.repoCredentialRemark);
    const defaultWorkerId = input.defaultWorkerId === undefined ? null : input.defaultWorkerId ? String(input.defaultWorkerId).trim() : null;
    if (defaultWorkerId) {
      // Validate robot-level worker defaults before persisting them so routing only references real executors. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      const worker = await db.worker.findUnique({ where: { id: defaultWorkerId }, select: { id: true, disabledAt: true } });
      if (!worker) throw new Error('defaultWorkerId not found');
      if (worker.disabledAt) throw new Error('defaultWorkerId is disabled');
    }

    // Change record: enforce explicit selection semantics now that both user/repo credentials can be multi-profile.
    if (repoCredentialSource === 'robot') {
      if (repoCredentialProfileId) throw new Error('repoCredentialProfileId must be null when repoCredentialSource=robot');
    } else {
      if (token) throw new Error('token must be null when repoCredentialSource is user/repo/global');
      if (repoCredentialSource !== 'global' && !repoCredentialProfileId) {
        throw new Error('repoCredentialProfileId is required when repoCredentialSource is user/repo');
      }
    }
    const promptDefault = String(input.promptDefault ?? '').trim();
    if (!promptDefault) throw new Error('promptDefault is required');
    const language = input.language === undefined ? null : input.language ? String(input.language).trim() : null;
    const sharedConfig = normalizeSharedRobotConfig({
      modelProvider: input.modelProvider,
      modelProviderConfig: input.modelProviderConfig,
      dependencyConfig: input.dependencyConfig,
      defaultBranch: input.defaultBranch,
      defaultBranchRole: input.defaultBranchRole,
      repoWorkflowMode: input.repoWorkflowMode,
      timeWindow: input.timeWindow
    });
    // New robots default to "pending activation": they can only be enabled after the token test passes.
    const enabled = false;
    const isDefault = input.isDefault === undefined ? false : Boolean(input.isDefault);

    const row = await db.repoRobot.create({
      data: {
        id,
        repoId,
        name,
        permission: sharedConfig.permission,
        token: repoCredentialSource === 'robot' ? token : null,
        cloneUsername,
        defaultWorkerId,
        repoCredentialSource,
        repoCredentialRemark: repoCredentialSource === 'robot' ? (repoCredentialRemark ?? null) : null,
        repoCredentialProfileId: repoCredentialSource === 'robot' ? null : repoCredentialProfileId,
        repoTokenUserId: null,
        repoTokenUsername: null,
        repoTokenUserName: null,
        repoTokenUserEmail: null,
        repoTokenRepoRole: null,
        repoTokenRepoRoleJson: Prisma.DbNull,
        // Persist repo workflow mode so task execution can enforce direct/fork selection. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        repoWorkflowMode: sharedConfig.repoWorkflowMode ?? null,
        // Persist robot-level time window hours for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        timeWindowStartHour: sharedConfig.timeWindow ? sharedConfig.timeWindow.startHour : null,
        timeWindowEndHour: sharedConfig.timeWindow ? sharedConfig.timeWindow.endHour : null,
        promptDefault,
        language,
        modelProvider: sharedConfig.modelProvider,
        modelProviderConfig: sharedConfig.modelProviderConfig,
        dependencyConfig: sharedConfig.dependencyConfig === undefined ? null : (sharedConfig.dependencyConfig as any),
        defaultBranchRole: sharedConfig.defaultBranchRole ?? null,
        defaultBranch: sharedConfig.defaultBranch ?? null,
        activatedAt: null,
        lastTestAt: null,
        lastTestOk: null,
        lastTestMessage: null,
        enabled,
        isDefault,
        createdAt: now,
        updatedAt: now
      }
    });
    return recordToRobot(row);
  }

  async updateRobot(id: string, input: UpdateRepoRobotInput): Promise<RepoRobot | null> {
    const now = new Date();
    const existing = await this.getByIdWithToken(id);
    if (!existing) return null;

    if (input.enabled === true) {
      throw new Error('robot must be activated by testing token');
    }

    const nextName =
      input.name === undefined ? existing.name : normalizeRobotName(String(input.name));
    if (!nextName) throw new Error('name is required');

    const existingToken = typeof existing.token === 'string' ? (existing.token.trim() ? existing.token.trim() : null) : null;
    const nextTokenRaw = input.token === undefined ? existingToken : input.token;
    const nextToken =
      typeof nextTokenRaw === 'string'
        ? (nextTokenRaw.trim() ? nextTokenRaw.trim() : null)
        : nextTokenRaw;
    const nextCloneUsername =
      input.cloneUsername === undefined ? existing.cloneUsername ?? null : input.cloneUsername;
    const existingSource =
      normalizeRepoCredentialSource(existing.repoCredentialSource) ??
      (existingToken ? 'robot' : String(existing.repoCredentialProfileId ?? '').trim() ? 'user' : 'repo');
    const requestedSource =
      input.repoCredentialSource === undefined || input.repoCredentialSource === null
        ? undefined
        : normalizeRepoCredentialSource(input.repoCredentialSource);

    const nextRepoCredentialSource = requestedSource ?? existingSource;

    const nextRepoCredentialProfileIdRaw =
      input.repoCredentialProfileId === undefined ? existing.repoCredentialProfileId ?? null : input.repoCredentialProfileId;
    const nextRepoCredentialProfileId =
      typeof nextRepoCredentialProfileIdRaw === 'string'
        ? (nextRepoCredentialProfileIdRaw.trim() ? nextRepoCredentialProfileIdRaw.trim() : null)
        : nextRepoCredentialProfileIdRaw;

    const nextRepoCredentialRemark =
      input.repoCredentialRemark === undefined
        ? (existing.repoCredentialRemark ?? null)
        : normalizeRepoCredentialRemark(input.repoCredentialRemark);

    const nextDefaultWorkerId =
      input.defaultWorkerId === undefined
        ? existing.defaultWorkerId ?? null
        : input.defaultWorkerId
          ? String(input.defaultWorkerId).trim()
          : null;
    if (nextDefaultWorkerId) {
      // Revalidate robot worker bindings on update so disabled or missing executors cannot be selected silently. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      const worker = await db.worker.findUnique({ where: { id: nextDefaultWorkerId }, select: { id: true, disabledAt: true } });
      if (!worker) throw new Error('defaultWorkerId not found');
      if (worker.disabledAt) throw new Error('defaultWorkerId is disabled');
    }

    // Change record: enforce explicit source + single selected profile semantics for multi-profile credentials.
    if (nextRepoCredentialSource === 'robot') {
      const profileProvided =
        input.repoCredentialProfileId !== undefined &&
        input.repoCredentialProfileId !== null &&
        String(input.repoCredentialProfileId ?? '').trim();
      if (profileProvided) {
        throw new Error('repoCredentialProfileId must be null when repoCredentialSource=robot');
      }
    } else {
      const tokenProvided =
        input.token !== undefined &&
        input.token !== null &&
        String(input.token ?? '').trim();
      if (tokenProvided) throw new Error('token must be null when repoCredentialSource is user/repo/global');
      if (nextRepoCredentialSource !== 'global' && !nextRepoCredentialProfileId) {
        throw new Error('repoCredentialProfileId is required when repoCredentialSource is user/repo');
      }
    }

    const nextPromptDefault =
      input.promptDefault === undefined ? String(existing.promptDefault ?? '').trim() : String(input.promptDefault ?? '').trim();
    if (!nextPromptDefault) throw new Error('promptDefault is required');
    const nextLanguage =
      input.language === undefined
        ? existing.language ?? null
        : input.language
          ? String(input.language).trim()
          : null;
    const nextModelProvider =
      input.modelProvider === undefined
        ? normalizeModelProvider(existing.modelProvider)
        : normalizeModelProvider(input.modelProvider);
    const nextModelProviderConfig =
      input.modelProviderConfig === undefined
        ? (existing.modelProviderConfigRaw ?? null)
        : mergeModelProviderConfig(nextModelProvider, { existing: existing.modelProviderConfigRaw ?? null, next: input.modelProviderConfig });
    const nextSharedConfig = normalizeSharedRobotConfig({
      modelProvider: nextModelProvider,
      modelProviderConfig: nextModelProviderConfig,
      dependencyConfig:
        input.dependencyConfig === undefined ? normalizeDependencyConfig(existing.dependencyConfig ?? null) : input.dependencyConfig,
      defaultBranch: input.defaultBranch === undefined ? existing.defaultBranch ?? null : input.defaultBranch,
      defaultBranchRole: input.defaultBranchRole === undefined ? existing.defaultBranchRole ?? null : input.defaultBranchRole,
      repoWorkflowMode: input.repoWorkflowMode === undefined ? existing.repoWorkflowMode ?? null : input.repoWorkflowMode,
      timeWindow: input.timeWindow === undefined ? existing.timeWindow ?? null : input.timeWindow
    });
    const timeWindowUpdate =
      input.timeWindow === undefined
        ? {}
        : {
            // Persist robot-level time window updates for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
            timeWindowStartHour: nextSharedConfig.timeWindow ? nextSharedConfig.timeWindow.startHour : null,
            timeWindowEndHour: nextSharedConfig.timeWindow ? nextSharedConfig.timeWindow.endHour : null
          };
    const sourceChanged = input.repoCredentialSource !== undefined && nextRepoCredentialSource !== existingSource;
    const profileChanged =
      input.repoCredentialProfileId !== undefined &&
      String(nextRepoCredentialProfileId ?? '').trim() !== String(existing.repoCredentialProfileId ?? '').trim();
    const tokenChanged = input.token !== undefined && nextToken !== existingToken;
    const credentialChanged = sourceChanged || tokenChanged || profileChanged;
    const nextEnabled =
      credentialChanged ? false : input.enabled === undefined ? existing.enabled : Boolean(input.enabled);
    const nextIsDefault = input.isDefault === undefined ? existing.isDefault : Boolean(input.isDefault);
    const nextActivatedAt = credentialChanged ? null : existing.activatedAt ?? null;
    const nextLastTestAt = credentialChanged ? null : existing.lastTestAt ?? null;
    const nextLastTestOk = credentialChanged ? null : existing.lastTestOk ?? null;
    const nextLastTestMessage = credentialChanged ? null : existing.lastTestMessage ?? null;

    const nextTokenIntrospection = credentialChanged
      ? {
          repoTokenUserId: null,
          repoTokenUsername: null,
          repoTokenUserName: null,
          repoTokenUserEmail: null,
          repoTokenRepoRole: null,
          repoTokenRepoRoleJson: Prisma.DbNull
        }
      : {};

    const row = await db.repoRobot.update({
      where: { id },
      data: {
        name: nextName,
        permission: nextSharedConfig.permission,
        token: nextRepoCredentialSource === 'robot' ? nextToken : null,
        cloneUsername: nextCloneUsername,
        defaultWorkerId: nextDefaultWorkerId,
        repoCredentialSource: nextRepoCredentialSource,
        repoCredentialRemark: nextRepoCredentialSource === 'robot' ? (nextRepoCredentialRemark ?? null) : null,
        repoCredentialProfileId: nextRepoCredentialSource === 'robot' ? null : nextRepoCredentialProfileId,
        promptDefault: nextPromptDefault,
        language: nextLanguage,
        modelProvider: nextSharedConfig.modelProvider,
        modelProviderConfig: nextSharedConfig.modelProviderConfig as any,
        dependencyConfig: nextSharedConfig.dependencyConfig === undefined ? undefined : (nextSharedConfig.dependencyConfig as any),
        defaultBranch: nextSharedConfig.defaultBranch ?? null,
        defaultBranchRole: (nextSharedConfig.defaultBranchRole ?? null) as any,
        // Store the chosen workflow mode so agent workflows can honor it. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        repoWorkflowMode: nextSharedConfig.repoWorkflowMode ?? null,
        ...timeWindowUpdate,
        activatedAt: nextActivatedAt ? new Date(nextActivatedAt) : nextActivatedAt,
        lastTestAt: nextLastTestAt ? new Date(nextLastTestAt) : nextLastTestAt,
        lastTestOk: nextLastTestOk as any,
        lastTestMessage: nextLastTestMessage,
        ...nextTokenIntrospection,
        enabled: nextEnabled,
        isDefault: nextIsDefault,
        updatedAt: now
      }
    });
    return row ? recordToRobot(row) : null;
  }

  async recordTestResult(
    id: string,
    result: {
      ok: boolean;
      message?: string | null;
      tokenInfo?: {
        userId?: string;
        username?: string;
        name?: string;
        email?: string;
        repoRole?: string;
        repoRoleDetails?: unknown;
      } | null;
    }
  ): Promise<RepoRobot | null> {
    const now = new Date();
    const ok = Boolean(result.ok);
    const message = result.message === undefined ? null : result.message;
    const tokenInfo = result.tokenInfo ?? null;

    const existing = await db.repoRobot.findUnique({ where: { id }, select: { activatedAt: true } });
    if (!existing) return null;
    const activatedAt = ok ? existing.activatedAt ?? now : existing.activatedAt;
    const row = await db.repoRobot.update({
      where: { id },
      data: {
        lastTestAt: now,
        lastTestOk: ok,
        lastTestMessage: message,
        enabled: ok,
        activatedAt,
        ...(ok && tokenInfo
          ? {
              repoTokenUserId: tokenInfo.userId ?? null,
              repoTokenUsername: tokenInfo.username ?? null,
              repoTokenUserName: tokenInfo.name ?? null,
              repoTokenUserEmail: tokenInfo.email ?? null,
              repoTokenRepoRole: tokenInfo.repoRole ?? null,
              repoTokenRepoRoleJson:
                tokenInfo.repoRoleDetails === undefined || tokenInfo.repoRoleDetails === null
                  ? Prisma.DbNull
                  : (tokenInfo.repoRoleDetails as any)
            }
          : {}),
        updatedAt: now
      }
    });
    return row ? recordToRobot(row) : null;
  }

  async setDefaultRobot(repoId: string, robotId: string): Promise<void> {
    const current = await this.getById(robotId);
    if (!current) throw new Error('Robot not found');
    if (current.repoId !== repoId) throw new Error('Robot does not belong to repo');

    const now = new Date();
    await db.$transaction([
      db.repoRobot.updateMany({
        where: { repoId, permission: current.permission },
        data: { isDefault: false, updatedAt: now }
      }),
      db.repoRobot.update({
        where: { id: robotId },
        data: { isDefault: true, updatedAt: now }
      })
    ]);
  }

  async deleteRobot(id: string): Promise<boolean> {
    const result = await db.repoRobot.deleteMany({ where: { id } });
    return result.count > 0;
  }
}
