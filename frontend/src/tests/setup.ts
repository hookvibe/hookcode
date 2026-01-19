import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetNavHistoryForTests } from '../navHistory';

// Mock ECharts in JSDOM to avoid Canvas API requirements during unit tests. nn62s3ci1xhpr7ublh51
vi.mock('echarts/core', () => {
  const makeInstance = () => ({
    clear: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
    setOption: vi.fn()
  });

  return {
    __esModule: true,
    use: vi.fn(),
    init: vi.fn(() => makeInstance())
  };
});

vi.mock('echarts/charts', () => ({ __esModule: true, LineChart: {} }));
vi.mock('echarts/components', () => ({ __esModule: true, GridComponent: {}, TooltipComponent: {} }));
vi.mock('echarts/renderers', () => ({ __esModule: true, CanvasRenderer: {} }));

afterEach(() => {
  // Test isolation: keep module-level navigation state from leaking across test files.
  resetNavHistoryForTests();
  if (typeof document !== 'undefined') {
    cleanup();
  }
  if (typeof window !== 'undefined') {
    // Keep tests isolated: avoid leaking auth/locale state between test files.
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {
      // ignore
    }
    window.location.hash = '';
  }
  // Keep SSE tests isolated: clear created EventSource instances between test cases. kxthpiu4eqrmu0c6bboa
  (globalThis as any).__eventSourceInstances = [];
});

if (typeof window !== 'undefined') {
  // Browser APIs required by Ant Design / rc-virtual-list (missing in JSDOM by default).
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  });

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;

  // Ant Design X Bubble.List uses IntersectionObserver to track "is at bottom" state for auto-scroll.
  // JSDOM doesn't provide it, so we stub a minimal implementation that reports `isIntersecting=true`.
  class IntersectionObserverMock {
    private readonly callback: (entries: any[]) => void;

    constructor(callback: (entries: any[]) => void) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([{ isIntersecting: true, target }]);
    }

    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  globalThis.IntersectionObserver = IntersectionObserverMock as any;

  window.scrollTo = () => {};

  // rc-util calls `getComputedStyle(el, pseudoElement)` when calculating scrollbar width;
  // JSDOM does not support the `pseudoElement` argument, so we ignore it.
  //
  // rc-textarea autoSize expects a numeric `lineHeight`; JSDOM returns `'normal'`, which becomes `NaN`
  // and triggers React warnings when applied to `style.height`.
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((elt: Element) => {
    const style = originalGetComputedStyle(elt);
    if (!(elt instanceof HTMLTextAreaElement || elt instanceof HTMLInputElement)) return style;

    const fallback = (name: string, raw: unknown): string => {
      const value = typeof raw === 'string' ? raw : '';
      const trimmed = value.trim();
      if (trimmed && trimmed !== 'normal') return trimmed;

      const key = name.toLowerCase();
      if (key === 'line-height') return '20px';
      if (key.startsWith('padding-')) return '0px';
      if (key.startsWith('border-') && key.endsWith('width')) return '0px';
      if (key === 'border-width') return '0px';
      if (key === 'box-sizing') return 'border-box';

      return trimmed;
    };

    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (name: string) => fallback(name, (target as any).getPropertyValue(name));
        }
        if (prop === 'lineHeight') return fallback('line-height', (target as any).lineHeight);
        return (target as any)[prop];
      }
    }) as any;
  }) as any;

  // EventSource is not available in JSDOM by default; TaskLogViewer relies on it for SSE.
  class EventSourceMock {
    url: string;
    readyState = 0;

    private listeners: Record<string, Array<(ev: any) => void>> = {};

    constructor(url: string) {
      this.url = url;
      const store = ((globalThis as any).__eventSourceInstances ??= []);
      store.push(this);
    }

    addEventListener(type: string, listener: (ev: any) => void) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(listener);
    }

    removeEventListener(type: string, listener: (ev: any) => void) {
      const list = this.listeners[type];
      if (!list?.length) return;
      this.listeners[type] = list.filter((fn) => fn !== listener);
    }

    close() {
      this.readyState = 2;
    }

    emit(type: string, ev: any = {}) {
      const list = this.listeners[type] ?? [];
      for (const fn of list) fn(ev);
    }
  }

  globalThis.EventSource = EventSourceMock as any;
}
