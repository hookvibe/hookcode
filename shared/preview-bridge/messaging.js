// Extract preview bridge message handling for highlight commands. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { BRIDGE_EVENT_PREFIX } from './constants.js';
import { applyHighlight, clearHighlight } from './highlight.js';

const sendMessage = (target, origin, payload) => {
  if (!target || !origin) return;
  try {
    target.postMessage(payload, origin);
  } catch {
    // ignore
  }
};

export const createMessageHandler = (state) => (event) => {
  const data = event && event.data ? event.data : null;
  if (!data || typeof data.type !== 'string') return;
  if (!data.type.startsWith(BRIDGE_EVENT_PREFIX)) return;

  if (data.type === `${BRIDGE_EVENT_PREFIX}ping`) {
    if (!state.allowedOrigin) state.allowedOrigin = event.origin;
    sendMessage(event.source, event.origin, { type: `${BRIDGE_EVENT_PREFIX}pong` });
    return;
  }

  if (!state.allowedOrigin) return;
  if (event.origin !== state.allowedOrigin) return;

  if (data.type === `${BRIDGE_EVENT_PREFIX}clear`) {
    clearHighlight(state);
    sendMessage(event.source, event.origin, { type: `${BRIDGE_EVENT_PREFIX}response`, requestId: data.requestId, ok: true });
    return;
  }

  if (data.type === `${BRIDGE_EVENT_PREFIX}highlight`) {
    const result = applyHighlight(state, data);
    sendMessage(event.source, event.origin, {
      type: `${BRIDGE_EVENT_PREFIX}response`,
      requestId: data.requestId,
      ok: result.ok,
      error: result.error
    });
  }
};
