import type { RobotDependencyConfig } from '../../types/dependency';
import type { RobotDefaultBranchRole, RobotPermission } from '../../types/repoRobot';
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
import { normalizeRepoWorkflowMode } from '../../services/repoWorkflowMode';
import { inferRobotPermission } from '../../services/robotPermission';
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
  // Normalize stored hour columns into a scheduling window for API output. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const normalized = normalizeTimeWindow({ startHour: start, endHour: end });
  return normalized ?? undefined;
};

const normalizeDependencyConfig = (value: unknown): RobotDependencyConfig | null | undefined => {
  // Normalize shared robot dependency overrides for storage and API output. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
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

const normalizeModelProvider = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return CODEX_PROVIDER_KEY;
  if (raw === CODEX_PROVIDER_KEY) return CODEX_PROVIDER_KEY;
  if (raw === CLAUDE_CODE_PROVIDER_KEY) return CLAUDE_CODE_PROVIDER_KEY;
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

const normalizeSharedRobotConfig = (params: {
  modelProvider?: unknown;
  modelProviderConfig?: unknown;
  dependencyConfig?: unknown;
  defaultBranch?: unknown;
  defaultBranchRole?: unknown;
  repoWorkflowMode?: unknown;
  timeWindow?: unknown;
}) => {
  const modelProvider = normalizeModelProvider(params.modelProvider);
  const modelProviderConfig = normalizeModelProviderConfig(modelProvider, params.modelProviderConfig);
  const dependencyConfig = normalizeDependencyConfig(params.dependencyConfig);
  const permission = inferRobotPermission({ modelProvider, modelProviderConfig });
  const defaultBranch = params.defaultBranch === undefined ? undefined : normalizeDefaultBranch(params.defaultBranch);
  const defaultBranchRole =
    params.defaultBranchRole === undefined ? undefined : normalizeDefaultBranchRole(params.defaultBranchRole);
  const repoWorkflowModeRaw = params.repoWorkflowMode === undefined ? undefined : params.repoWorkflowMode;
  const repoWorkflowMode =
    repoWorkflowModeRaw === undefined || repoWorkflowModeRaw === null ? null : normalizeRepoWorkflowMode(repoWorkflowModeRaw);
  if (repoWorkflowModeRaw !== undefined && repoWorkflowModeRaw !== null && !repoWorkflowMode) {
    throw new Error('repoWorkflowMode must be auto, direct, or fork');
  }
  const timeWindowRaw = params.timeWindow === undefined ? undefined : params.timeWindow;
  const timeWindow =
    timeWindowRaw === undefined || timeWindowRaw === null ? null : normalizeTimeWindow(timeWindowRaw);
  if (timeWindowRaw !== undefined && timeWindowRaw !== null && !timeWindow) {
    throw new Error('timeWindow must include startHour/endHour between 0 and 23');
  }
  return { modelProvider, modelProviderConfig, dependencyConfig, permission, defaultBranch, defaultBranchRole, repoWorkflowMode, timeWindow };
};

export {
  buildTimeWindow,
  mergeModelProviderConfig,
  normalizeDefaultBranch,
  normalizeDefaultBranchRole,
  normalizeDependencyConfig,
  normalizeLanguage,
  normalizeModelProvider,
  normalizeModelProviderConfig,
  normalizePermission,
  normalizeRobotName,
  normalizeSharedRobotConfig,
  toIso,
  toPublicModelProviderConfig
};
