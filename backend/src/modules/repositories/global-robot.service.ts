import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import type { GlobalRobot, GlobalRobotWithTokenLike } from '../../types/globalRobot';
import type { RobotDefaultBranchRole } from '../../types/repoRobot';
import type { RobotDependencyConfig } from '../../types/dependency';
import type { TimeWindow } from '../../types/timeWindow';
import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { hasStoredProfileId } from '../../utils/credentialProfiles';
import {
  buildTimeWindow,
  mergeModelProviderConfig,
  normalizeDependencyConfig,
  normalizeLanguage,
  normalizeModelProvider,
  normalizePermission,
  normalizeRobotName,
  normalizeSharedRobotConfig,
  toIso,
  toPublicModelProviderConfig
} from './robot-config.shared';
import { GlobalCredentialService } from './global-credentials.service';

const normalizeRepoCredentialSource = (value: unknown): 'global' | 'user' | 'repo' | undefined => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'global' || raw === 'user' || raw === 'repo') return raw;
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asTrimmedString = (value: unknown): string =>
  (typeof value === 'string' ? value : '').trim();

const recordToGlobalRobot = (row: any): GlobalRobot => ({
  // Mark globally shared robots explicitly so mixed-scope APIs can surface origin reliably. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  scope: 'global',
  id: String(row.id),
  name: String(row.name),
  permission: normalizePermission(String(row.permission)),
  repoCredentialSource: row.repoCredentialSource ?? undefined,
  repoCredentialProfileId: row.repoCredentialProfileId ?? undefined,
  defaultWorkerId: row.defaultWorkerId ?? undefined,
  promptDefault: row.promptDefault ?? undefined,
  language: normalizeLanguage(row.language),
  modelProvider: row.modelProvider ? String(row.modelProvider) : CODEX_PROVIDER_KEY,
  modelProviderConfig: toPublicModelProviderConfig(row.modelProvider ? String(row.modelProvider) : CODEX_PROVIDER_KEY, row.modelProviderConfig),
  dependencyConfig: row.dependencyConfig ?? undefined,
  defaultBranch: row.defaultBranch ?? undefined,
  defaultBranchRole: row.defaultBranchRole ?? undefined,
  repoWorkflowMode: row.repoWorkflowMode ?? undefined,
  timeWindow: buildTimeWindow(row.timeWindowStartHour, row.timeWindowEndHour),
  enabled: Boolean(row.enabled),
  isDefault: Boolean(row.isDefault),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt)
});

export interface CreateGlobalRobotInput {
  name: string;
  defaultWorkerId?: string | null;
  repoCredentialSource?: 'global' | 'user' | 'repo' | string | null;
  repoCredentialProfileId?: string | null;
  promptDefault: string;
  language?: string | null;
  modelProvider?: string | null;
  modelProviderConfig?: unknown;
  dependencyConfig?: RobotDependencyConfig | null;
  defaultBranch?: string | null;
  defaultBranchRole?: RobotDefaultBranchRole | null;
  repoWorkflowMode?: 'auto' | 'direct' | 'fork' | string | null;
  timeWindow?: TimeWindow | null;
  enabled?: boolean;
  isDefault?: boolean;
}

export interface UpdateGlobalRobotInput extends Partial<CreateGlobalRobotInput> {}

@Injectable()
export class GlobalRobotService {
  constructor(private readonly globalCredentialService: GlobalCredentialService) {}

  private async validateGlobalCredentialBindings(params: {
    repoCredentialSource: 'global' | 'user' | 'repo';
    repoCredentialProfileId?: string | null;
    modelProvider: string;
    modelProviderConfig: unknown;
  }): Promise<void> {
    const repoCredentialProfileId = asTrimmedString(params.repoCredentialProfileId);
    const modelProviderConfig = isRecord(params.modelProviderConfig) ? params.modelProviderConfig : {};
    const modelCredentialSource = asTrimmedString(modelProviderConfig.credentialSource);
    const modelCredentialProfileId = asTrimmedString(modelProviderConfig.credentialProfileId);
    if (!(params.repoCredentialSource === 'global' && repoCredentialProfileId) && !(modelCredentialSource === 'global' && modelCredentialProfileId)) {
      return;
    }

    const globalCredentials = await this.globalCredentialService.getCredentialsRaw();
    if (params.repoCredentialSource === 'global' && repoCredentialProfileId) {
      // Global robots are repo-provider agnostic at save time, so accept explicit repo profile ids that exist in either shared GitHub or GitLab stores. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
      const repoProfileExists =
        hasStoredProfileId(globalCredentials.github?.profiles, repoCredentialProfileId) ||
        hasStoredProfileId(globalCredentials.gitlab?.profiles, repoCredentialProfileId);
      if (!repoProfileExists) {
        throw new Error('repoCredentialProfileId does not exist in global credentials');
      }
    }

    if (modelCredentialSource === 'global' && modelCredentialProfileId) {
      const providerCredentials = (globalCredentials as any)?.[params.modelProvider];
      if (!hasStoredProfileId(providerCredentials?.profiles, modelCredentialProfileId)) {
        throw new Error(`${params.modelProvider} credentialProfileId does not exist in global credentials`);
      }
    }
  }

  async listAll(): Promise<GlobalRobot[]> {
    const rows = await db.globalRobot.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(recordToGlobalRobot);
  }

  async listEnabled(): Promise<GlobalRobot[]> {
    const rows = await db.globalRobot.findMany({ where: { enabled: true }, orderBy: { createdAt: 'asc' } });
    return rows.map(recordToGlobalRobot);
  }

  async listAllWithConfig(): Promise<GlobalRobotWithTokenLike[]> {
    const rows = await db.globalRobot.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({ ...recordToGlobalRobot(row), modelProviderConfigRaw: row.modelProviderConfig ?? undefined }));
  }

  async listEnabledWithConfig(): Promise<GlobalRobotWithTokenLike[]> {
    const rows = await db.globalRobot.findMany({ where: { enabled: true }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({ ...recordToGlobalRobot(row), modelProviderConfigRaw: row.modelProviderConfig ?? undefined }));
  }

  async getById(id: string): Promise<GlobalRobot | null> {
    const row = await db.globalRobot.findUnique({ where: { id } });
    return row ? recordToGlobalRobot(row) : null;
  }

  async getByIdWithConfig(id: string): Promise<GlobalRobotWithTokenLike | null> {
    const row = await db.globalRobot.findUnique({ where: { id } });
    return row ? { ...recordToGlobalRobot(row), modelProviderConfigRaw: row.modelProviderConfig ?? undefined } : null;
  }

  async createRobot(actor: { id: string } | null, input: CreateGlobalRobotInput): Promise<GlobalRobot> {
    const id = randomUUID();
    const now = new Date();
    const name = normalizeRobotName(String(input.name ?? ''));
    if (!name) throw new Error('name is required');
    const promptDefault = String(input.promptDefault ?? '').trim();
    if (!promptDefault) throw new Error('promptDefault is required');
    const repoCredentialSource = normalizeRepoCredentialSource(input.repoCredentialSource) ?? 'global';
    const repoCredentialProfileId =
      typeof input.repoCredentialProfileId === 'string' ? (input.repoCredentialProfileId.trim() || null) : input.repoCredentialProfileId ?? null;
    const defaultWorkerId =
      input.defaultWorkerId === undefined ? null : input.defaultWorkerId ? String(input.defaultWorkerId).trim() : null;
    if (defaultWorkerId) {
      // Validate shared worker bindings before persisting global robot routing. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
      const worker = await db.worker.findUnique({ where: { id: defaultWorkerId }, select: { id: true, disabledAt: true } });
      if (!worker) throw new Error('defaultWorkerId not found');
      if (worker.disabledAt) throw new Error('defaultWorkerId is disabled');
    }

    const sharedConfig = normalizeSharedRobotConfig({
      modelProvider: input.modelProvider,
      modelProviderConfig: input.modelProviderConfig,
      dependencyConfig: input.dependencyConfig,
      defaultBranch: input.defaultBranch,
      defaultBranchRole: input.defaultBranchRole,
      repoWorkflowMode: input.repoWorkflowMode,
      timeWindow: input.timeWindow
    });
    // Validate shared global profile bindings before persistence so stale ids fail during admin edits instead of at execution time. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    await this.validateGlobalCredentialBindings({
      repoCredentialSource,
      repoCredentialProfileId,
      modelProvider: sharedConfig.modelProvider,
      modelProviderConfig: sharedConfig.modelProviderConfig
    });

    const row = await db.globalRobot.create({
      data: {
        id,
        name,
        permission: sharedConfig.permission,
        defaultWorkerId,
        repoCredentialSource,
        repoCredentialProfileId,
        repoWorkflowMode: sharedConfig.repoWorkflowMode ?? null,
        timeWindowStartHour: sharedConfig.timeWindow ? sharedConfig.timeWindow.startHour : null,
        timeWindowEndHour: sharedConfig.timeWindow ? sharedConfig.timeWindow.endHour : null,
        promptDefault,
        language: input.language === undefined ? null : input.language ? String(input.language).trim() : null,
        modelProvider: sharedConfig.modelProvider,
        modelProviderConfig: sharedConfig.modelProviderConfig,
        dependencyConfig: sharedConfig.dependencyConfig === undefined ? null : (sharedConfig.dependencyConfig as any),
        defaultBranchRole: sharedConfig.defaultBranchRole ?? null,
        defaultBranch: sharedConfig.defaultBranch ?? null,
        enabled: typeof input.enabled === 'boolean' ? input.enabled : false,
        isDefault: Boolean(input.isDefault),
        createdAt: now,
        updatedAt: now
      }
    });
    return recordToGlobalRobot(row);
  }

  async updateRobot(id: string, input: UpdateGlobalRobotInput): Promise<GlobalRobot | null> {
    const existing = await this.getByIdWithConfig(id);
    if (!existing) return null;

    const nextName = input.name === undefined ? existing.name : normalizeRobotName(String(input.name));
    if (!nextName) throw new Error('name is required');
    const nextPromptDefault =
      input.promptDefault === undefined ? String(existing.promptDefault ?? '').trim() : String(input.promptDefault ?? '').trim();
    if (!nextPromptDefault) throw new Error('promptDefault is required');

    const nextDefaultWorkerId =
      input.defaultWorkerId === undefined ? existing.defaultWorkerId ?? null : input.defaultWorkerId ? String(input.defaultWorkerId).trim() : null;
    if (nextDefaultWorkerId) {
      // Revalidate shared worker bindings on global robot updates so disabled executors cannot be selected silently. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
      const worker = await db.worker.findUnique({ where: { id: nextDefaultWorkerId }, select: { id: true, disabledAt: true } });
      if (!worker) throw new Error('defaultWorkerId not found');
      if (worker.disabledAt) throw new Error('defaultWorkerId is disabled');
    }

    const nextModelProvider = input.modelProvider === undefined ? normalizeModelProvider(existing.modelProvider) : normalizeModelProvider(input.modelProvider);
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

    const nextRepoCredentialSource =
      input.repoCredentialSource === undefined ? existing.repoCredentialSource ?? 'global' : normalizeRepoCredentialSource(input.repoCredentialSource) ?? 'global';
    const nextRepoCredentialProfileId =
      input.repoCredentialProfileId === undefined
        ? existing.repoCredentialProfileId ?? null
        : typeof input.repoCredentialProfileId === 'string'
          ? input.repoCredentialProfileId.trim() || null
          : input.repoCredentialProfileId ?? null;
    // Re-check shared global profile references on update so later profile deletions are caught before the robot is saved again. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    await this.validateGlobalCredentialBindings({
      repoCredentialSource: nextRepoCredentialSource,
      repoCredentialProfileId: nextRepoCredentialProfileId,
      modelProvider: nextSharedConfig.modelProvider,
      modelProviderConfig: nextSharedConfig.modelProviderConfig
    });

    const row = await db.globalRobot.update({
      where: { id },
      data: {
        name: nextName,
        permission: nextSharedConfig.permission,
        defaultWorkerId: nextDefaultWorkerId,
        repoCredentialSource: nextRepoCredentialSource,
        repoCredentialProfileId: nextRepoCredentialProfileId,
        repoWorkflowMode: nextSharedConfig.repoWorkflowMode ?? null,
        timeWindowStartHour: input.timeWindow === undefined ? undefined : nextSharedConfig.timeWindow ? nextSharedConfig.timeWindow.startHour : null,
        timeWindowEndHour: input.timeWindow === undefined ? undefined : nextSharedConfig.timeWindow ? nextSharedConfig.timeWindow.endHour : null,
        promptDefault: nextPromptDefault,
        language:
          input.language === undefined ? existing.language ?? null : input.language ? String(input.language).trim() : null,
        modelProvider: nextSharedConfig.modelProvider,
        modelProviderConfig: nextSharedConfig.modelProviderConfig as any,
        dependencyConfig: nextSharedConfig.dependencyConfig === undefined ? undefined : (nextSharedConfig.dependencyConfig as any),
        defaultBranchRole: (nextSharedConfig.defaultBranchRole ?? null) as any,
        defaultBranch: nextSharedConfig.defaultBranch ?? null,
        enabled: input.enabled === undefined ? existing.enabled : Boolean(input.enabled),
        isDefault: input.isDefault === undefined ? existing.isDefault : Boolean(input.isDefault),
        updatedAt: new Date()
      }
    });
    return recordToGlobalRobot(row);
  }

  async setDefaultRobot(robotId: string): Promise<void> {
    const current = await this.getById(robotId);
    if (!current) throw new Error('Robot not found');
    const now = new Date();
    await db.$transaction([
      db.globalRobot.updateMany({
        where: { permission: current.permission },
        data: { isDefault: false, updatedAt: now }
      }),
      db.globalRobot.update({
        where: { id: robotId },
        data: { isDefault: true, updatedAt: now }
      })
    ]);
  }

  async deleteRobot(id: string): Promise<boolean> {
    const result = await db.globalRobot.deleteMany({ where: { id } });
    return result.count > 0;
  }
}
