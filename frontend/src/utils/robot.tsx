import type { ModelProvider } from '../api';

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
