// HookCode preview bridge for cross-origin highlight commands. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
(function () {
  const BRIDGE_EVENT_PREFIX = 'hookcode:preview:';
  const OVERLAY_ID = 'hookcode-preview-highlight';
  const MASK_ID = 'hookcode-preview-mask';
  const DEFAULT_COLOR = '#ff4d4f';
  const DEFAULT_PADDING = 4;

  let allowedOrigin = null;
  let trackedElement = null;
  let cleanupFn = null;

  const ensureOverlay = () => {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.position = 'fixed';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2147483647';
      overlay.style.borderRadius = '6px';
      overlay.style.transition = 'all 120ms ease-out';
      document.body.appendChild(overlay);
    }
    return overlay;
  };

  const ensureMask = () => {
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

  const clearHighlight = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    const mask = document.getElementById(MASK_ID);
    if (mask) mask.remove();
    if (cleanupFn) cleanupFn();
    cleanupFn = null;
    trackedElement = null;
  };

  const applyHighlight = (payload) => {
    if (!payload || typeof payload.selector !== 'string') {
      return { ok: false, error: 'selector_required' };
    }
    const selector = payload.selector.trim();
    if (!selector) return { ok: false, error: 'selector_required' };

    const target = document.querySelector(selector);
    if (!target) return { ok: false, error: 'selector_not_found' };

    const padding = Number.isFinite(payload.padding) ? Math.max(0, payload.padding) : DEFAULT_PADDING;
    const color = typeof payload.color === 'string' && payload.color.trim() ? payload.color.trim() : DEFAULT_COLOR;
    const mode = payload.mode === 'mask' ? 'mask' : 'outline';

    if (payload.scrollIntoView) {
      try {
        target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      } catch {
        target.scrollIntoView();
      }
    }

    clearHighlight();
    const overlay = ensureOverlay();
    overlay.style.border = `2px solid ${color}`;
    overlay.style.boxShadow = `0 0 0 2px ${color}55`;

    if (mode === 'mask') {
      const mask = ensureMask();
      mask.style.opacity = '1';
    } else {
      const mask = document.getElementById(MASK_ID);
      if (mask) mask.remove();
    }

    const update = () => {
      const rect = target.getBoundingClientRect();
      overlay.style.top = `${rect.top - padding}px`;
      overlay.style.left = `${rect.left - padding}px`;
      overlay.style.width = `${rect.width + padding * 2}px`;
      overlay.style.height = `${rect.height + padding * 2}px`;
    };

    update();
    trackedElement = target;

    const handle = () => {
      if (!trackedElement) return;
      update();
    };

    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handle) : null;
    if (observer) observer.observe(target);
    cleanupFn = () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
      if (observer) observer.disconnect();
    };

    return { ok: true };
  };

  const sendMessage = (target, origin, payload) => {
    if (!target || !origin) return;
    try {
      target.postMessage(payload, origin);
    } catch {
      // ignore
    }
  };

  const handleMessage = (event) => {
    const data = event && event.data ? event.data : null;
    if (!data || typeof data.type !== 'string') return;
    if (!data.type.startsWith(BRIDGE_EVENT_PREFIX)) return;

    if (data.type === `${BRIDGE_EVENT_PREFIX}ping`) {
      if (!allowedOrigin) allowedOrigin = event.origin;
      sendMessage(event.source, event.origin, { type: `${BRIDGE_EVENT_PREFIX}pong` });
      return;
    }

    if (!allowedOrigin) return;
    if (event.origin !== allowedOrigin) return;

    if (data.type === `${BRIDGE_EVENT_PREFIX}clear`) {
      clearHighlight();
      sendMessage(event.source, event.origin, { type: `${BRIDGE_EVENT_PREFIX}response`, requestId: data.requestId, ok: true });
      return;
    }

    if (data.type === `${BRIDGE_EVENT_PREFIX}highlight`) {
      const result = applyHighlight(data);
      sendMessage(event.source, event.origin, {
        type: `${BRIDGE_EVENT_PREFIX}response`,
        requestId: data.requestId,
        ok: result.ok,
        error: result.error
      });
    }
  };

  window.addEventListener('message', handleMessage);
  window.__HOOKCODE_PREVIEW_BRIDGE__ = {
    clear: clearHighlight
  };
})();
