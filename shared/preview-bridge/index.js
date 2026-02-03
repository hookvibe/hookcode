// Provide the preview bridge initializer after splitting the monolith. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { clearHighlight } from './highlight.js';
import { createMessageHandler } from './messaging.js';
import { createBridgeState } from './state.js';

export const initPreviewBridge = () => {
  const state = createBridgeState();
  const handleMessage = createMessageHandler(state);

  window.addEventListener('message', handleMessage);
  window.__HOOKCODE_PREVIEW_BRIDGE__ = {
    clear: () => clearHighlight(state)
  };

  return state;
};
