// Extract preview highlight application logic into a reusable module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import {
  DEFAULT_BUBBLE,
  DEFAULT_COLOR,
  DEFAULT_PADDING,
  HIGHLIGHT_PULSE_DURATION_MS,
  HIGHLIGHT_PULSE_ITERATIONS,
  MASK_ID,
  OVERLAY_ID
} from './constants.js';
import { ensureBubble, ensureMask, ensureOverlay, ensureStyles, clearBubble } from './dom.js';
import { clamp, normalizeBubble, prefersReducedMotion } from './utils.js';

export const clearHighlight = (state) => {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.remove();
  const mask = document.getElementById(MASK_ID);
  if (mask) mask.remove();
  clearBubble();
  if (state.cleanupFn) state.cleanupFn();
  state.cleanupFn = null;
  state.trackedElement = null;
};

export const applyHighlight = (state, payload) => {
  if (!payload || typeof payload.selector !== 'string') {
    return { ok: false, error: 'selector_required' };
  }
  const selector = payload.selector.trim();
  if (!selector) return { ok: false, error: 'selector_required' };

  const target = document.querySelector(selector);
  if (!target) return { ok: false, error: 'selector_not_found' };

  // Validate and normalize bubble payload before rendering. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  const bubble = normalizeBubble(payload.bubble);
  if (payload.bubble && !bubble) {
    return { ok: false, error: 'bubble_text_required' };
  }

  const padding = Number.isFinite(payload.padding) ? Math.max(0, payload.padding) : DEFAULT_PADDING;
  const color = typeof payload.color === 'string' && payload.color.trim() ? payload.color.trim() : DEFAULT_COLOR;
  const mode = payload.mode === 'mask' ? 'mask' : 'outline';

  const reducedMotion = prefersReducedMotion();
  if (payload.scrollIntoView) {
    try {
      if (reducedMotion) {
        target.scrollIntoView({ block: 'center', inline: 'center' });
      } else {
        target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      }
    } catch {
      target.scrollIntoView();
    }
  }

  clearHighlight(state);
  ensureStyles();
  const overlay = ensureOverlay();
  overlay.style.transition = reducedMotion ? 'none' : 'all 140ms ease-out';
  // Apply richer highlight styling and glow animation. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  const highlightBorder = `2px solid ${color}`;
  overlay.style.border = highlightBorder;
  overlay.style.setProperty('--hookcode-highlight-glow', `${color}66`);
  overlay.style.setProperty('--hookcode-highlight-pulse', `${color}44`);
  overlay.style.background = `linear-gradient(135deg, ${color}20, transparent 60%)`;
  overlay.style.boxShadow = `0 0 0 2px ${color}55, 0 10px 24px ${color}33`;
  overlay.style.animation = reducedMotion
    ? 'none'
    : `hookcode-highlight-pulse ${HIGHLIGHT_PULSE_DURATION_MS}ms ease-out ${HIGHLIGHT_PULSE_ITERATIONS}`;
  overlay.style.animationFillMode = 'none';

  if (mode === 'mask') {
    const mask = ensureMask();
    mask.style.opacity = '1';
    mask.style.transition = reducedMotion ? 'none' : 'opacity 160ms ease-out';
    mask.style.background = 'rgba(10, 12, 20, 0.5)';
  } else {
    const mask = document.getElementById(MASK_ID);
    if (mask) mask.remove();
  }

  const bubbleNodes = bubble ? ensureBubble(reducedMotion) : null;

  const update = () => {
    const rect = target.getBoundingClientRect();
    const highlightRect = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    };
    highlightRect.right = highlightRect.left + highlightRect.width;
    highlightRect.bottom = highlightRect.top + highlightRect.height;

    overlay.style.top = `${highlightRect.top}px`;
    overlay.style.left = `${highlightRect.left}px`;
    overlay.style.width = `${highlightRect.width}px`;
    overlay.style.height = `${highlightRect.height}px`;

    if (bubble && bubbleNodes) {
      const bubbleNode = bubbleNodes.bubble;
      const bubbleText = bubbleNodes.text;
      const bubbleArrow = bubbleNodes.arrow;
      if (!bubbleText || !bubbleArrow) return;

      const themeColors = DEFAULT_BUBBLE[bubble.theme];
      const background = bubble.background || themeColors.background;
      const textColor = bubble.textColor || themeColors.text;
      const borderColor = bubble.borderColor || themeColors.border;

      bubbleNode.style.maxWidth = `${bubble.maxWidth}px`;
      bubbleNode.style.padding = '10px 12px';
      bubbleNode.style.borderRadius = `${bubble.radius}px`;
      bubbleNode.style.background = background;
      bubbleNode.style.color = textColor;
      bubbleNode.style.border = `1px solid ${borderColor}`;
      bubbleNode.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.18)';
      bubbleNode.style.opacity = '1';

      bubbleText.textContent = bubble.text;

      // Position bubble relative to highlight and clamp to viewport. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
      const bubbleRect = bubbleNode.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const offset = bubble.offset;

      const anchor = {
        top: highlightRect.top,
        left: highlightRect.left,
        right: highlightRect.right,
        bottom: highlightRect.bottom,
        width: highlightRect.width,
        height: highlightRect.height,
        centerX: highlightRect.left + highlightRect.width / 2,
        centerY: highlightRect.top + highlightRect.height / 2
      };

      const spaceTop = anchor.top;
      const spaceBottom = viewportHeight - anchor.bottom;
      const spaceLeft = anchor.left;
      const spaceRight = viewportWidth - anchor.right;

      let placement = bubble.placement;
      if (placement === 'auto') {
        const candidates = [
          { side: 'top', space: spaceTop },
          { side: 'bottom', space: spaceBottom },
          { side: 'right', space: spaceRight },
          { side: 'left', space: spaceLeft }
        ];
        candidates.sort((a, b) => b.space - a.space);
        placement = candidates[0].side;
      }

      let top = 0;
      let left = 0;
      if (placement === 'top') {
        top = anchor.top - offset - bubbleRect.height;
        if (bubble.align === 'start') {
          left = anchor.left;
        } else if (bubble.align === 'end') {
          left = anchor.right - bubbleRect.width;
        } else {
          left = anchor.centerX - bubbleRect.width / 2;
        }
      } else if (placement === 'bottom') {
        top = anchor.bottom + offset;
        if (bubble.align === 'start') {
          left = anchor.left;
        } else if (bubble.align === 'end') {
          left = anchor.right - bubbleRect.width;
        } else {
          left = anchor.centerX - bubbleRect.width / 2;
        }
      } else if (placement === 'left') {
        left = anchor.left - offset - bubbleRect.width;
        if (bubble.align === 'start') {
          top = anchor.top;
        } else if (bubble.align === 'end') {
          top = anchor.bottom - bubbleRect.height;
        } else {
          top = anchor.centerY - bubbleRect.height / 2;
        }
      } else {
        left = anchor.right + offset;
        if (bubble.align === 'start') {
          top = anchor.top;
        } else if (bubble.align === 'end') {
          top = anchor.bottom - bubbleRect.height;
        } else {
          top = anchor.centerY - bubbleRect.height / 2;
        }
      }

      const margin = 8;
      top = clamp(top, margin, viewportHeight - bubbleRect.height - margin);
      left = clamp(left, margin, viewportWidth - bubbleRect.width - margin);

      bubbleNode.style.top = `${top}px`;
      bubbleNode.style.left = `${left}px`;

      if (bubble.arrow === false) {
        bubbleArrow.style.display = 'none';
      } else {
        bubbleArrow.style.display = 'block';
        bubbleArrow.style.background = background;
        bubbleArrow.style.border = `1px solid ${borderColor}`;
        const arrowSize = 10;
        const arrowOffset = 6;
        if (placement === 'top') {
          bubbleArrow.style.top = `${bubbleRect.height - arrowSize / 2}px`;
          bubbleArrow.style.left = `${clamp(anchor.centerX - left - arrowSize / 2, arrowOffset, bubbleRect.width - arrowOffset - arrowSize)}px`;
        } else if (placement === 'bottom') {
          bubbleArrow.style.top = `${-arrowSize / 2}px`;
          bubbleArrow.style.left = `${clamp(anchor.centerX - left - arrowSize / 2, arrowOffset, bubbleRect.width - arrowOffset - arrowSize)}px`;
        } else if (placement === 'left') {
          bubbleArrow.style.left = `${bubbleRect.width - arrowSize / 2}px`;
          bubbleArrow.style.top = `${clamp(anchor.centerY - top - arrowSize / 2, arrowOffset, bubbleRect.height - arrowOffset - arrowSize)}px`;
        } else {
          bubbleArrow.style.left = `${-arrowSize / 2}px`;
          bubbleArrow.style.top = `${clamp(anchor.centerY - top - arrowSize / 2, arrowOffset, bubbleRect.height - arrowOffset - arrowSize)}px`;
        }
      }
    } else {
      clearBubble();
    }
  };

  update();
  state.trackedElement = target;

  const handle = () => {
    if (!state.trackedElement) return;
    update();
  };

  window.addEventListener('scroll', handle, true);
  window.addEventListener('resize', handle);
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handle) : null;
  if (observer) observer.observe(target);
  state.cleanupFn = () => {
    window.removeEventListener('scroll', handle, true);
    window.removeEventListener('resize', handle);
    if (observer) observer.disconnect();
  };

  return { ok: true };
};
