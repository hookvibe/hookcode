/**
 * Neutral accent tokens (fixed across themes).
 *
 * Business context:
 * - Module: Frontend Chat / Theme.
 * - Purpose: keep UI accents consistent while enforcing a flat, neutral palette.
 *
 * Change record:
 * - 2026-02-03: Lock accent tokens to neutral gray for the flat style refresh.
 */

export interface AccentColors {
  primary: string;
  hover: string;
  active: string;
}

// Lock accent tokens to neutral gray to match the flat palette. docs/en/developer/plans/uiuxflat20260203/task_plan.md uiuxflat20260203
export const NEUTRAL_ACCENT: AccentColors = {
  primary: '#64748b',
  hover: '#475569',
  active: '#334155'
};
