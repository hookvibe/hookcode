import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const BRIDGE_EVENT_PREFIX = 'hookcode:preview:';
const BRIDGE_ORIGIN = 'https://preview.test';

// Provide a minimal bridge typing for tests that access the global helper. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
declare global {
  interface Window {
    __HOOKCODE_PREVIEW_BRIDGE__?: { clear?: () => void };
  }
}

const loadBridgeScript = () => {
  // Execute the preview bridge script in JSDOM to validate selector fallbacks. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const bridgePath = path.resolve(process.cwd(), '../shared/preview-bridge.js');
  const script = fs.readFileSync(bridgePath, 'utf8');
  window.eval(script);
};

const sendBridgeMessage = (payload: Record<string, unknown>) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: payload,
      origin: BRIDGE_ORIGIN,
      source: window
    })
  );
};

const sendPing = () => {
  sendBridgeMessage({ type: `${BRIDGE_EVENT_PREFIX}ping` });
};

// Build highlight payloads with optional bubble data for matcher behavior tests. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
const sendHighlight = (
  selector: string,
  options: { padding?: number; bubble?: Record<string, unknown> } = {}
) => {
  const { padding = 4, bubble } = options;
  sendBridgeMessage({
    type: `${BRIDGE_EVENT_PREFIX}highlight`,
    selector,
    padding,
    ...(bubble ? { bubble } : {}),
    requestId: 'test-request'
  });
};

const setMockRect = (element: HTMLElement, rect: { top: number; left: number; width: number; height: number }) => {
  element.getBoundingClientRect = () => ({
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ''
  });
  element.getClientRects = () => (rect.width > 0 && rect.height > 0 ? [rect as DOMRect] : []);
};

const getOverlay = () => document.getElementById('hookcode-preview-highlight');

// Validate preview-bridge selector fallbacks in JSDOM without bundling the bridge script. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
describe('preview-bridge selector fallbacks', () => {
  beforeAll(() => {
    loadBridgeScript();
    sendPing();
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    window.__HOOKCODE_PREVIEW_BRIDGE__?.clear?.();
  });

  test('falls back to id lookup when CSS selector parsing fails', () => {
    const target = document.createElement('div');
    target.id = 'hero:cta';
    document.body.appendChild(target);
    setMockRect(target, { top: 10, left: 20, width: 80, height: 40 });

    sendHighlight('#hero:cta');

    const overlay = getOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.style.top).toBe('6px');
    expect(overlay?.style.left).toBe('16px');
    expect(overlay?.style.width).toBe('88px');
    expect(overlay?.style.height).toBe('48px');
  });

  test('prefers a visible match when multiple nodes share a selector', () => {
    const hidden = document.createElement('div');
    hidden.className = 'multi-target';
    hidden.style.display = 'none';
    document.body.appendChild(hidden);
    setMockRect(hidden, { top: 0, left: 0, width: 0, height: 0 });

    const visible = document.createElement('div');
    visible.className = 'multi-target';
    document.body.appendChild(visible);
    setMockRect(visible, { top: 30, left: 40, width: 50, height: 20 });

    sendHighlight('.multi-target');

    const overlay = getOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.style.top).toBe('26px');
    expect(overlay?.style.left).toBe('36px');
    expect(overlay?.style.width).toBe('58px');
    expect(overlay?.style.height).toBe('28px');
  });

  test('finds matches inside open shadow roots when light DOM lookup fails', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const target = document.createElement('button');
    target.className = 'shadow-target';
    shadow.appendChild(target);
    document.body.appendChild(host);
    setMockRect(target, { top: 5, left: 5, width: 60, height: 30 });

    sendHighlight('.shadow-target');

    const overlay = getOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.style.top).toBe('1px');
    expect(overlay?.style.left).toBe('1px');
    expect(overlay?.style.width).toBe('68px');
    expect(overlay?.style.height).toBe('38px');
  });

  // Cover text and attribute matcher rules beyond raw CSS selectors. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  test('supports text matcher rules for visible content', () => {
    const hidden = document.createElement('span');
    hidden.textContent = 'Save changes';
    hidden.style.display = 'none';
    document.body.appendChild(hidden);
    setMockRect(hidden, { top: 0, left: 0, width: 0, height: 0 });

    const visible = document.createElement('button');
    visible.textContent = 'Save changes';
    document.body.appendChild(visible);
    setMockRect(visible, { top: 20, left: 30, width: 120, height: 32 });

    sendHighlight('text:Save changes');

    const overlay = getOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.style.top).toBe('16px');
    expect(overlay?.style.left).toBe('26px');
    expect(overlay?.style.width).toBe('128px');
    expect(overlay?.style.height).toBe('40px');
  });

  test('supports attribute matcher rules for data-testid shorthand', () => {
    const target = document.createElement('div');
    target.setAttribute('data-testid', 'hero-cta');
    document.body.appendChild(target);
    setMockRect(target, { top: 44, left: 12, width: 90, height: 22 });

    sendHighlight('data-testid=hero-cta');

    const overlay = getOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.style.top).toBe('40px');
    expect(overlay?.style.left).toBe('8px');
    expect(overlay?.style.width).toBe('98px');
    expect(overlay?.style.height).toBe('30px');
  });

  // Validate bubble placement flips away from the viewport edge to avoid clipping. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  test('flips bubble placement when bottom space is insufficient', () => {
    const originalHeight = window.innerHeight;
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });

    const target = document.createElement('div');
    target.className = 'bubble-target';
    document.body.appendChild(target);
    setMockRect(target, { top: 160, left: 30, width: 80, height: 20 });

    sendHighlight('.bubble-target', {
      bubble: { text: 'Save changes', placement: 'bottom', offset: 10 }
    });

    const bubble = document.getElementById('hookcode-preview-bubble') as HTMLElement | null;
    expect(bubble).not.toBeNull();
    if (bubble) {
      bubble.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        width: 120,
        height: 60,
        right: 120,
        bottom: 60,
        x: 0,
        y: 0,
        toJSON: () => ''
      });
      window.dispatchEvent(new Event('resize'));
      expect(bubble.style.top).toBe('86px');
      expect(bubble.style.left).toBe('10px');
    }

    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });
});
