// Extract preview bridge helper utilities for parsing and layout. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { DEFAULT_BUBBLE_MAX_WIDTH, DEFAULT_BUBBLE_OFFSET, DEFAULT_BUBBLE_RADIUS, DEFAULT_BUBBLE_THEME } from './constants.js';

export const prefersReducedMotion = () => {
  // Respect reduced motion preferences for highlight/tooltip animations. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  if (!window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const parseNumber = (value, fallback) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const normalizeBubble = (bubble) => {
  // Normalize bubble config defaults for consistent layout. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  if (!bubble || typeof bubble.text !== 'string') return null;
  const text = bubble.text.trim();
  if (!text) return null;
  return {
    text,
    placement: ['top', 'right', 'bottom', 'left', 'auto'].includes(bubble.placement)
      ? bubble.placement
      : 'auto',
    align: ['start', 'center', 'end'].includes(bubble.align) ? bubble.align : 'center',
    offset: clamp(parseNumber(bubble.offset, DEFAULT_BUBBLE_OFFSET), 0, 64),
    maxWidth: clamp(parseNumber(bubble.maxWidth, DEFAULT_BUBBLE_MAX_WIDTH), 120, 640),
    theme: bubble.theme === 'light' ? 'light' : DEFAULT_BUBBLE_THEME,
    background: typeof bubble.background === 'string' ? bubble.background.trim() : '',
    textColor: typeof bubble.textColor === 'string' ? bubble.textColor.trim() : '',
    borderColor: typeof bubble.borderColor === 'string' ? bubble.borderColor.trim() : '',
    radius: clamp(parseNumber(bubble.radius, DEFAULT_BUBBLE_RADIUS), 0, 24),
    arrow: typeof bubble.arrow === 'boolean' ? bubble.arrow : true
  };
};
