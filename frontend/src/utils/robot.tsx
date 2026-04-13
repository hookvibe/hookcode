import type { AvailableRobot, ModelProvider, TaskRobotSummary } from '../api';

const PROVIDER_LABELS: Record<string, string> = {
  codex: 'codex',
  claude_code: 'claude',
  gemini_cli: 'gemini'
};

const normalizeProvider = (provider?: ModelProvider | null): string => {
  if (typeof provider !== 'string') return '';
  return provider.trim();
};

export const getRobotProviderLabel = (provider?: ModelProvider | null): string | null => {
  // Normalize provider labels for compact robot displays. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
  const normalized = normalizeProvider(provider);
  if (!normalized) return null;
  return PROVIDER_LABELS[normalized] ?? normalized;
};

export const formatRobotLabelWithProvider = (name: string, provider?: ModelProvider | null): string => {
  // Append bound AI provider to robot labels in a compact format. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
  const trimmed = String(name ?? '').trim();
  const providerLabel = getRobotProviderLabel(provider);
  if (!providerLabel) return trimmed;
  if (!trimmed) return providerLabel;
  return `${trimmed} / ${providerLabel}`;
};

const getRobotScopeLabel = (scope?: 'repo' | 'global' | null): string => {
  if (scope === 'global') return 'Global';
  return 'Repo';
};

export const formatRobotOptionLabel = (robot: Pick<AvailableRobot, 'name' | 'id' | 'modelProvider' | 'scope'>): string => {
  // Label mixed-scope robot options with provider + origin so repo/global choices stay obvious in selectors. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const base = formatRobotLabelWithProvider(robot.name || robot.id, robot.modelProvider);
  return `${base} / ${getRobotScopeLabel(robot.scope)}`;
};

export const formatTaskRobotSummaryLabel = (robot: Pick<TaskRobotSummary, 'name' | 'id' | 'modelProvider' | 'scope'>): string => {
  return formatRobotOptionLabel({
    id: robot.id,
    name: robot.name,
    modelProvider: robot.modelProvider,
    scope: robot.scope
  } as AvailableRobot);
};
