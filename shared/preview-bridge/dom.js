// Extract DOM helpers for preview highlight overlays and bubble UI. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import {
  BUBBLE_ARROW_ID,
  BUBBLE_GLASS_BLUR,
  BUBBLE_ID,
  BUBBLE_TEXT_ID,
  DEFAULT_BUBBLE_MAX_WIDTH,
  MASK_ID,
  OVERLAY_ID,
  STYLE_ID
} from './constants.js';

export const ensureStyles = () => {
  // Inject highlight/bubble keyframes once for smooth visuals. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
      @keyframes hookcode-highlight-pulse {
        0% { box-shadow: 0 0 0 2px var(--hookcode-highlight-glow, rgba(255, 255, 255, 0.3)), 0 0 0 0 var(--hookcode-highlight-pulse, rgba(255, 255, 255, 0)); }
        70% { box-shadow: 0 0 0 2px var(--hookcode-highlight-glow, rgba(255, 255, 255, 0.3)), 0 0 26px 8px var(--hookcode-highlight-pulse, rgba(255, 255, 255, 0.25)); }
        100% { box-shadow: 0 0 0 2px var(--hookcode-highlight-glow, rgba(255, 255, 255, 0.3)), 0 0 0 0 var(--hookcode-highlight-pulse, rgba(255, 255, 255, 0)); }
      }
      @keyframes hookcode-bubble-pop {
        0% { opacity: 0; transform: translateY(6px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
  document.head.appendChild(style);
};

export const ensureOverlay = () => {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647';
    overlay.style.borderRadius = '6px';
    overlay.style.transition = 'all 140ms ease-out';
    document.body.appendChild(overlay);
  }
  return overlay;
};

export const ensureMask = () => {
  let mask = document.getElementById(MASK_ID);
  if (!mask) {
    mask = document.createElement('div');
    mask.id = MASK_ID;
    mask.style.position = 'fixed';
    mask.style.inset = '0';
    mask.style.pointerEvents = 'none';
    mask.style.zIndex = '2147483646';
    mask.style.background = 'rgba(0, 0, 0, 0.35)';
    mask.style.transition = 'opacity 120ms ease-out';
    document.body.appendChild(mask);
  }
  return mask;
};

export const ensureBubble = (reducedMotion) => {
  // Build the tooltip bubble DOM used by highlight commands. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  let bubble = document.getElementById(BUBBLE_ID);
  const isNew = !bubble;
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = BUBBLE_ID;
    bubble.style.position = 'fixed';
    bubble.style.pointerEvents = 'none';
    bubble.style.zIndex = '2147483648';
    bubble.style.display = 'block';
    bubble.style.boxSizing = 'border-box';
    bubble.style.maxWidth = `${DEFAULT_BUBBLE_MAX_WIDTH}px`;
    bubble.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
    bubble.style.fontSize = '12px';
    bubble.style.lineHeight = '1.4';
    bubble.style.opacity = reducedMotion ? '1' : '0';
    bubble.style.transform = reducedMotion ? 'translateY(0)' : 'translateY(6px)';
    bubble.style.animation = reducedMotion ? 'none' : 'hookcode-bubble-pop 160ms ease-out forwards';
    bubble.style.transition = reducedMotion ? 'none' : 'opacity 160ms ease-out, transform 160ms ease-out';
    bubble.style.backdropFilter = BUBBLE_GLASS_BLUR;
    bubble.style.webkitBackdropFilter = BUBBLE_GLASS_BLUR;

    const text = document.createElement('div');
    text.id = BUBBLE_TEXT_ID;
    text.style.wordBreak = 'break-word';
    bubble.appendChild(text);

    const arrow = document.createElement('div');
    arrow.id = BUBBLE_ARROW_ID;
    arrow.style.position = 'absolute';
    arrow.style.width = '10px';
    arrow.style.height = '10px';
    arrow.style.transform = 'rotate(45deg)';
    arrow.style.borderRadius = '2px';
    bubble.appendChild(arrow);

    document.body.appendChild(bubble);
  }
  if (!isNew) {
    bubble.style.transition = reducedMotion ? 'none' : 'opacity 160ms ease-out, transform 160ms ease-out';
    bubble.style.backdropFilter = BUBBLE_GLASS_BLUR;
    bubble.style.webkitBackdropFilter = BUBBLE_GLASS_BLUR;
    if (reducedMotion) {
      bubble.style.animation = 'none';
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateY(0)';
    }
  }
  const arrow = bubble.querySelector(`#${BUBBLE_ARROW_ID}`);
  const text = bubble.querySelector(`#${BUBBLE_TEXT_ID}`);
  return { bubble, arrow, text };
};

export const clearBubble = () => {
  // Remove bubble nodes when clearing highlights. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  const bubble = document.getElementById(BUBBLE_ID);
  if (bubble) bubble.remove();
};
