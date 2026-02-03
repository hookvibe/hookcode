// Extract preview bridge constants for reuse across modules. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export const BRIDGE_EVENT_PREFIX = 'hookcode:preview:';
export const STYLE_ID = 'hookcode-preview-style';
export const OVERLAY_ID = 'hookcode-preview-highlight';
export const MASK_ID = 'hookcode-preview-mask';
export const BUBBLE_ID = 'hookcode-preview-bubble';
export const BUBBLE_ARROW_ID = 'hookcode-preview-bubble-arrow';
export const BUBBLE_TEXT_ID = 'hookcode-preview-bubble-text';
export const DEFAULT_COLOR = '#ff4d4f';
export const DEFAULT_PADDING = 4;
export const DEFAULT_BUBBLE_MAX_WIDTH = 320;
export const DEFAULT_BUBBLE_OFFSET = 10;
export const DEFAULT_BUBBLE_RADIUS = 12;
export const DEFAULT_BUBBLE_THEME = 'dark';
// Limit highlight pulse loops and set glass blur defaults. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
export const HIGHLIGHT_PULSE_ITERATIONS = 2;
export const HIGHLIGHT_PULSE_DURATION_MS = 1200;
export const BUBBLE_GLASS_BLUR = 'blur(12px) saturate(160%)';
// Define default bubble theme colors for tooltip rendering. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
export const DEFAULT_BUBBLE = {
  dark: {
    background: 'rgba(15, 23, 42, 0.92)',
    text: '#f8fafc',
    border: 'rgba(148, 163, 184, 0.35)'
  },
  light: {
    background: '#ffffff',
    text: '#0f172a',
    border: 'rgba(148, 163, 184, 0.45)'
  }
};
