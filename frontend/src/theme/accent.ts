/**
 * Accent color presets (shared by light/dark themes).
 *
 * Business context:
 * - Module: Frontend Chat / Theme.
 * - Purpose: keep the UI "accent" consistent across custom CSS (`--accent*`) and Ant Design tokens.
 *
 * Change record:
 * - 2026-01-11: Added minimal accent preset resolver for the static chat demo.
 */

export type AccentPreset = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'slate';

export const ACCENT_STORAGE_KEY = 'hookcode-accent';

export interface AccentColors {
  primary: string;
  hover: string;
  active: string;
}

export interface AccentPresetOption extends AccentColors {
  key: AccentPreset;
}

export const ACCENT_PRESET_OPTIONS: readonly AccentPresetOption[] = [
  { key: 'blue', primary: '#2563eb', hover: '#3b82f6', active: '#1d4ed8' },
  { key: 'emerald', primary: '#10b981', hover: '#34d399', active: '#059669' },
  { key: 'violet', primary: '#7c3aed', hover: '#8b5cf6', active: '#6d28d9' },
  { key: 'amber', primary: '#d97706', hover: '#f59e0b', active: '#b45309' },
  { key: 'rose', primary: '#e11d48', hover: '#fb7185', active: '#be123c' },
  { key: 'slate', primary: '#64748b', hover: '#94a3b8', active: '#475569' }
] as const;

const isAccentPreset = (value: unknown): value is AccentPreset =>
  typeof value === 'string' && ACCENT_PRESET_OPTIONS.some((option) => option.key === value);

export const resolveAccentPreset = (preset: AccentPreset): AccentPresetOption => {
  const found = ACCENT_PRESET_OPTIONS.find((option) => option.key === preset);
  return found ?? ACCENT_PRESET_OPTIONS[0];
};

export const getInitialAccentPreset = (): AccentPreset => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return 'blue';
  const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return isAccentPreset(stored) ? stored : 'blue';
};

