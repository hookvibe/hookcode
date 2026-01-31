import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { db } from '../../db';
import type { RepoRobot, RobotPermission, RobotDefaultBranchRole } from '../../types/repoRobot';
import type { RobotDependencyConfig } from '../../types/dependency';
import type { TimeWindow } from '../../types/timeWindow';
import {
  CODEX_PROVIDER_KEY,
  mergeCodexRobotProviderConfig,
  normalizeCodexRobotProviderConfig,
  toPublicCodexRobotProviderConfig
} from '../../modelProviders/codex';
import {
  CLAUDE_CODE_PROVIDER_KEY,
  mergeClaudeCodeRobotProviderConfig,
  normalizeClaudeCodeRobotProviderConfig,
  toPublicClaudeCodeRobotProviderConfig
} from '../../modelProviders/claudeCode';
import {
  GEMINI_CLI_PROVIDER_KEY,
  mergeGeminiCliRobotProviderConfig,
  normalizeGeminiCliRobotProviderConfig,
  toPublicGeminiCliRobotProviderConfig
} from '../../modelProviders/geminiCli';
import { inferRobotPermission } from '../../services/robotPermission';
import { normalizeRepoWorkflowMode } from '../../services/repoWorkflowMode';
import { normalizeTimeWindow } from '../../utils/timeWindow';

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const normalizeRobotName = (name: string): string => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
};

const normalizePermission = (value: string): RobotPermission => {
  const raw = value.trim().toLowerCase();
  if (raw === 'read' || raw === 'write') return raw;
  throw new Error('permission must be read or write');
};

const normalizeDefaultBranchRole = (value: unknown): RobotDefaultBranchRole | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'main' || raw === 'dev' || raw === 'test') return raw;
  return undefined;
};

const normalizeDefaultBranch = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  return raw ? raw : undefined;
};

const normalizeLanguage = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  return raw ? raw : undefined;
};

const buildTimeWindow = (start: unknown, end: unknown): TimeWindow | undefined => {
  // Normalize stored hour columns into a scheduling window for API output. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const normalized = normalizeTimeWindow({ startHour: start, endHour: end });
  return normalized ?? undefined;
};

const normalizeDependencyConfig = (value: unknown): RobotDependencyConfig | null | undefined => {
  // Normalize robot dependency overrides for storage and API output. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object') throw new Error('dependencyConfig must be an object');
  const raw = value as Record<string, unknown>;
  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : undefined;
  const allowCustomInstall = typeof raw.allowCustomInstall === 'boolean' ? raw.allowCustomInstall : undefined;
  const failureModeRaw = typeof raw.failureMode === 'string' ? raw.failureMode.trim().toLowerCase() : '';
  if (failureModeRaw && failureModeRaw !== 'soft' && failureModeRaw !== 'hard') {
    throw new Error('dependencyConfig.failureMode must be soft or hard');
  }
  const failureMode = failureModeRaw ? (failureModeRaw as RobotDependencyConfig['failureMode']) : undefined;
  return { enabled, allowCustomInstall, failureMode };
};

const normalizeRepoCredentialSource = (value: unknown): 'robot' | 'user' | 'repo' | undefined => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'robot' || raw === 'user' || raw === 'repo') return raw;
  return undefined;
};

const normalizeRepoCredentialRemark = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw : null;
};

const normalizeModelProvider = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return CODEX_PROVIDER_KEY;
  if (raw === CODEX_PROVIDER_KEY) return CODEX_PROVIDER_KEY;
  // Change record: allow selecting Claude Code as a model provider for repo robots.
  if (raw === CLAUDE_CODE_PROVIDER_KEY) return CLAUDE_CODE_PROVIDER_KEY;
  // Change record: allow selecting Gemini CLI as a model provider for repo robots.
  if (raw === GEMINI_CLI_PROVIDER_KEY) return GEMINI_CLI_PROVIDER_KEY;
  throw new Error('modelProvider must be codex, claude_code, or gemini_cli');
};

const normalizeModelProviderConfig = (provider: string, value: unknown): any => {
  if (provider === CODEX_PROVIDER_KEY) return normalizeCodexRobotProviderConfig(value) as any;
  if (provider === CLAUDE_CODE_PROVIDER_KEY) return normalizeClaudeCodeRobotProviderConfig(value) as any;
  if (provider === GEMINI_CLI_PROVIDER_KEY) return normalizeGeminiCliRobotProviderConfig(value) as any;
  return null;
};

const mergeModelProviderConfig = (provider: string, params: { existing: unknown; next: unknown }): any => {
  if (provider === CODEX_PROVIDER_KEY) return mergeCodexRobotProviderConfig(params) as any;
  if (provider === CLAUDE_CODE_PROVIDER_KEY) return mergeClaudeCodeRobotProviderConfig(params) as any;
  if (provider === GEMINI_CLI_PROVIDER_KEY) return mergeGeminiCliRobotProviderConfig(params) as any;
  return normalizeModelProviderConfig(provider, params.next);
};

const toPublicModelProviderConfig = (provider: string, value: unknown): unknown => {
  if (provider === CODEX_PROVIDER_KEY) return toPublicCodexRobotProviderConfig(value);
  if (provider === CLAUDE_CODE_PROVIDER_KEY) return toPublicClaudeCodeRobotProviderConfig(value);
  if (provider === GEMINI_CLI_PROVIDER_KEY) return toPublicGeminiCliRobotProviderConfig(value);
  return undefined;
};

const recordToRobot = (row: any): RepoRobot => ({
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
  repoCredentialSource?: 'robot' | 'user' | 'repo' | string | null;
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
  repoCredentialSource?: 'robot' | 'user' | 'repo' | string | null;
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

    // Change record: enforce explicit selection semantics now that both user/repo credentials can be multi-profile.
    if (repoCredentialSource === 'robot') {
      if (repoCredentialProfileId) throw new Error('repoCredentialProfileId must be null when repoCredentialSource=robot');
    } else {
      if (token) throw new Error('token must be null when repoCredentialSource is user/repo');
      if (!repoCredentialProfileId) {
        throw new Error('repoCredentialProfileId is required when repoCredentialSource is user/repo');
      }
    }
    const promptDefault = String(input.promptDefault ?? '').trim();
    if (!promptDefault) throw new Error('promptDefault is required');
    const language = input.language === undefined ? null : input.language ? String(input.language).trim() : null;
    const modelProvider = normalizeModelProvider(input.modelProvider);
    const modelProviderConfig = normalizeModelProviderConfig(modelProvider, input.modelProviderConfig);
    // Normalize dependency overrides before persisting robot configuration. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const dependencyConfig = normalizeDependencyConfig(input.dependencyConfig);
    const permission = inferRobotPermission({ modelProvider, modelProviderConfig });
    const defaultBranch =
      input.defaultBranch === undefined ? null : input.defaultBranch ? String(input.defaultBranch).trim() : null;
    const defaultBranchRole = input.defaultBranchRole === undefined ? null : input.defaultBranchRole;
    // Normalize explicit workflow mode input for robot creation (auto/direct/fork). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
    const repoWorkflowModeRaw = input.repoWorkflowMode === undefined ? null : input.repoWorkflowMode;
    const repoWorkflowMode =
      repoWorkflowModeRaw === null ? null : normalizeRepoWorkflowMode(repoWorkflowModeRaw);
    if (repoWorkflowModeRaw !== null && !repoWorkflowMode) {
      throw new Error('repoWorkflowMode must be auto, direct, or fork');
    }
    // Normalize robot-level time windows for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    const timeWindowInput = input.timeWindow;
    const timeWindow =
      timeWindowInput === undefined || timeWindowInput === null ? null : normalizeTimeWindow(timeWindowInput);
    if (timeWindowInput !== undefined && timeWindowInput !== null && !timeWindow) {
      throw new Error('timeWindow must include startHour/endHour between 0 and 23');
    }
    // New robots default to "pending activation": they can only be enabled after the token test passes.
    const enabled = false;
    const isDefault = input.isDefault === undefined ? false : Boolean(input.isDefault);

    const row = await db.repoRobot.create({
      data: {
        id,
        repoId,
        name,
        permission,
        token: repoCredentialSource === 'robot' ? token : null,
        cloneUsername,
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
        repoWorkflowMode: repoWorkflowMode ?? null,
        // Persist robot-level time window hours for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        timeWindowStartHour: timeWindow ? timeWindow.startHour : null,
        timeWindowEndHour: timeWindow ? timeWindow.endHour : null,
        promptDefault,
        language,
        modelProvider,
        modelProviderConfig,
        dependencyConfig: dependencyConfig === undefined ? null : (dependencyConfig as any),
        defaultBranchRole,
        defaultBranch,
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
      if (tokenProvided) throw new Error('token must be null when repoCredentialSource is user/repo');
      if (!nextRepoCredentialProfileId) {
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
    // Apply dependency override updates when the robot is patched. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const nextDependencyConfig =
      input.dependencyConfig === undefined ? normalizeDependencyConfig(existing.dependencyConfig ?? null) : normalizeDependencyConfig(input.dependencyConfig);
    const nextPermission = inferRobotPermission({ modelProvider: nextModelProvider, modelProviderConfig: nextModelProviderConfig });
    const nextDefaultBranch =
      input.defaultBranch === undefined
        ? existing.defaultBranch ?? null
        : input.defaultBranch
          ? String(input.defaultBranch).trim()
          : null;
    const nextDefaultBranchRole =
      input.defaultBranchRole === undefined
        ? existing.defaultBranchRole ?? null
        : input.defaultBranchRole;
    // Normalize workflow mode updates while keeping legacy robots on auto by default. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
    const nextRepoWorkflowModeRaw =
      input.repoWorkflowMode === undefined ? existing.repoWorkflowMode ?? null : input.repoWorkflowMode;
    const nextRepoWorkflowMode =
      nextRepoWorkflowModeRaw === null ? null : normalizeRepoWorkflowMode(nextRepoWorkflowModeRaw);
    if (nextRepoWorkflowModeRaw !== null && !nextRepoWorkflowMode) {
      throw new Error('repoWorkflowMode must be auto, direct, or fork');
    }
    // Normalize robot-level time window updates for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    const nextTimeWindowInput = input.timeWindow;
    const nextTimeWindow =
      nextTimeWindowInput === undefined
        ? existing.timeWindow ?? null
        : nextTimeWindowInput === null
          ? null
          : normalizeTimeWindow(nextTimeWindowInput);
    if (nextTimeWindowInput !== undefined && nextTimeWindowInput !== null && !nextTimeWindow) {
      throw new Error('timeWindow must include startHour/endHour between 0 and 23');
    }
    const timeWindowUpdate =
      nextTimeWindowInput === undefined
        ? {}
        : {
            // Persist robot-level time window updates for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
            timeWindowStartHour: nextTimeWindow ? nextTimeWindow.startHour : null,
            timeWindowEndHour: nextTimeWindow ? nextTimeWindow.endHour : null
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
        permission: nextPermission,
        token: nextRepoCredentialSource === 'robot' ? nextToken : null,
        cloneUsername: nextCloneUsername,
        repoCredentialSource: nextRepoCredentialSource,
        repoCredentialRemark: nextRepoCredentialSource === 'robot' ? (nextRepoCredentialRemark ?? null) : null,
        repoCredentialProfileId: nextRepoCredentialSource === 'robot' ? null : nextRepoCredentialProfileId,
        promptDefault: nextPromptDefault,
        language: nextLanguage,
        modelProvider: nextModelProvider,
        modelProviderConfig: nextModelProviderConfig as any,
        dependencyConfig: nextDependencyConfig === undefined ? undefined : (nextDependencyConfig as any),
        defaultBranch: nextDefaultBranch,
        defaultBranchRole: nextDefaultBranchRole as any,
        // Store the chosen workflow mode so agent workflows can honor it. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        repoWorkflowMode: nextRepoWorkflowMode ?? null,
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
