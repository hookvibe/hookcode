// Split TaskGroupChatPage preview tests into a dedicated spec file. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTaskGroupChatPage, setupTaskGroupChatMocks } from './taskGroupChatPageTestUtils';
import * as api from '../api';

describe('TaskGroupChatPage preview', () => {
  beforeEach(() => {
    setupTaskGroupChatMocks();
  });

  test('renders preview tabs when multiple instances are configured', async () => {
    // Verify multi-instance preview tab rendering for Phase 2 UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [
        { name: 'frontend', display: 'webview', status: 'running', path: '/preview/g1/frontend/' },
        { name: 'admin', display: 'webview', status: 'stopped', path: '/preview/g1/admin/' }
      ]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchTaskGroupPreviewStatus).toHaveBeenCalled());
    // Preview tabs should appear automatically once preview becomes active. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    expect(await screen.findByRole('button', { name: 'frontend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin' })).toBeInTheDocument();
  });

  test('keeps stop action clickable when at least one preview instance is running', async () => {
    // Prevent mixed running+starting states from forcing the header action into a stuck loading state. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [
        { name: 'frontend', display: 'webview', status: 'running', port: 12345, path: '/preview/g1/frontend/' },
        { name: 'admin', display: 'webview', status: 'starting', port: 12346, path: '/preview/g1/admin/' }
      ]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchTaskGroupPreviewStatus).toHaveBeenCalled());
    const stopButton = await screen.findByRole('button', { name: 'Stop preview' });
    expect(stopButton).toBeEnabled();
    expect(stopButton.className).not.toContain('ant-btn-loading');
  });

  test('defaults preview panel width to half on wide layouts', async () => {
    // Ensure the preview panel defaults to half width on wide layouts. docs/en/developer/plans/2gtiyjttzqy1dd3s4k1o/task_plan.md 2gtiyjttzqy1dd3s4k1o
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', display: 'webview', status: 'running', port: 12345, path: '/preview/g1/frontend/' }]
    });

    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rectSpy.mockImplementation(function () {
      if (this instanceof HTMLElement && this.classList?.contains('hc-chat-layout')) {
        return {
          width: 1200,
          height: 800,
          top: 0,
          left: 0,
          right: 1200,
          bottom: 800,
          x: 0,
          y: 0,
          toJSON: () => ({})
        };
      }
      return {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
      };
    });

    window.localStorage.removeItem('hc-preview-panel-width');

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    try {
      await waitFor(() => {
        const panel = document.querySelector('.hc-preview-panel') as HTMLElement | null;
        expect(panel).not.toBeNull();
        expect(panel?.style.width).toBe('600px');
      });
    } finally {
      rectSpy.mockRestore();
    }
  });

  test('uses direct port preview URL on localhost', async () => {
    // Validate local direct-port routing for preview iframes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', display: 'webview', status: 'running', port: 12345, path: '/preview/g1/frontend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const iframe = await screen.findByTitle('frontend');
    expect(iframe).toHaveAttribute('src', 'http://127.0.0.1:12345/');
  });

  test('renders preview browser toolbar with sandboxed iframe', async () => {
    // Ensure the preview iframe toolbar and sandbox are enabled. docs/en/developer/plans/2se7kgnqyp427d5nvoej/task_plan.md 2se7kgnqyp427d5nvoej
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', display: 'webview', status: 'running', port: 12345, path: '/preview/g1/frontend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const iframe = await screen.findByTitle('frontend');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    expect(screen.getByLabelText('Back')).toBeInTheDocument();
    expect(screen.getByLabelText('Forward')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a URL')).toBeInTheDocument();
  });

  test('renders terminal-mode previews with inline log output instead of iframe controls', async () => {
    // Validate display=terminal instances render log output in-panel and hide iframe-only controls. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'backend', display: 'terminal', status: 'running', port: 12345, path: '/preview/g1/backend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchTaskGroupPreviewStatus).toHaveBeenCalled());
    expect(screen.queryByLabelText('Back')).not.toBeInTheDocument();
    expect(screen.queryByTitle('backend')).not.toBeInTheDocument();

    const sources = (globalThis as any).__eventSourceInstances ?? [];
    const logsSource = sources.find((source: any) => String(source.url).includes('/task-groups/g1/preview/backend/logs'));
    expect(logsSource).toBeTruthy();
    logsSource.emit('init', {
      data: JSON.stringify({
        instance: { name: 'backend', display: 'terminal', status: 'running', path: '/preview/g1/backend/' },
        logs: [{ timestamp: '2026-03-03T00:00:00.000Z', level: 'stdout', message: 'server ready' }]
      })
    });

    expect(await screen.findByText('server ready')).toBeInTheDocument();
  });

  test('auto-follows terminal logs until user scrolls up, then resumes after returning to bottom', async () => {
    // Keep terminal previews pinned to the latest logs unless users intentionally scroll up. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'backend', display: 'terminal', status: 'running', port: 12345, path: '/preview/g1/backend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });
    await waitFor(() => expect(api.fetchTaskGroupPreviewStatus).toHaveBeenCalled());

    const terminal = document.querySelector('.hc-preview-terminal') as HTMLDivElement | null;
    expect(terminal).toBeTruthy();
    if (!terminal) return;

    Object.defineProperty(terminal, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(terminal, 'scrollHeight', { value: 600, configurable: true });

    const sources = (globalThis as any).__eventSourceInstances ?? [];
    const logsSource = sources.find((source: any) => String(source.url).includes('/task-groups/g1/preview/backend/logs'));
    expect(logsSource).toBeTruthy();
    logsSource.emit('init', {
      data: JSON.stringify({
        instance: { name: 'backend', display: 'terminal', status: 'running', path: '/preview/g1/backend/' },
        logs: [{ timestamp: '2026-03-03T00:00:00.000Z', level: 'stdout', message: 'line 1' }]
      })
    });
    await waitFor(() => expect(terminal.scrollTop).toBe(600));

    terminal.scrollTop = 100;
    terminal.dispatchEvent(new Event('scroll'));

    Object.defineProperty(terminal, 'scrollHeight', { value: 650, configurable: true });
    logsSource.emit('log', {
      data: JSON.stringify({ timestamp: '2026-03-03T00:00:01.000Z', level: 'stdout', message: 'line 2' })
    });
    await waitFor(() => expect(terminal.textContent ?? '').toContain('line 2'));
    expect(terminal.scrollTop).toBe(100);

    terminal.scrollTop = 650;
    terminal.dispatchEvent(new Event('scroll'));

    Object.defineProperty(terminal, 'scrollHeight', { value: 700, configurable: true });
    logsSource.emit('log', {
      data: JSON.stringify({ timestamp: '2026-03-03T00:00:02.000Z', level: 'stdout', message: 'line 3' })
    });
    await waitFor(() => expect(terminal.textContent ?? '').toContain('line 3'));
    await waitFor(() => expect(terminal.scrollTop).toBe(700));
  });

  test('forwards highlight commands to the preview iframe bridge', async () => {
    // Ensure preview highlight SSE events postMessage into the iframe bridge. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', display: 'webview', status: 'running', port: 12345, path: '/preview/g1/frontend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const iframe = await screen.findByTitle('frontend');
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage }, writable: true });
    iframe.dispatchEvent(new Event('load'));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'hookcode:preview:pong' },
        origin: 'http://127.0.0.1:12345'
      })
    );

    const sources = (globalThis as any).__eventSourceInstances ?? [];
    const highlightSource = sources.find((source: any) =>
      decodeURIComponent(String(source.url)).includes('preview-highlight:g1')
    );
    expect(highlightSource).toBeTruthy();
    highlightSource.emit('preview.highlight', {
      data: JSON.stringify({
        taskGroupId: 'g1',
        instanceName: 'frontend',
        // Forward bubble payloads alongside highlight commands. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
        command: {
          selector: '.btn',
          color: '#ff4d4f',
          bubble: { text: 'Primary CTA', placement: 'right' }
        },
        issuedAt: '2026-01-31T00:00:00.000Z'
      })
    });

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hookcode:preview:highlight',
          selector: '.btn',
          bubble: expect.objectContaining({ text: 'Primary CTA' })
        }),
        'http://127.0.0.1:12345'
      )
    );
  });

  test('auto-navigates previews when highlight commands include target URLs', async () => {
    // Ensure preview highlight commands can drive iframe navigation when targetUrl is provided. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', display: 'webview', status: 'running', port: 12345, path: '/preview/g1/frontend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const iframe = await screen.findByTitle('frontend');
    expect(iframe).toHaveAttribute('src', 'http://127.0.0.1:12345/');

    const sources = (globalThis as any).__eventSourceInstances ?? [];
    const highlightSource = sources.find((source: any) =>
      decodeURIComponent(String(source.url)).includes('preview-highlight:g1')
    );
    expect(highlightSource).toBeTruthy();
    highlightSource.emit('preview.highlight', {
      data: JSON.stringify({
        taskGroupId: 'g1',
        instanceName: 'frontend',
        command: {
          selector: '.btn',
          targetUrl: '/add'
        },
        issuedAt: '2026-02-04T00:00:00.000Z'
      })
    });

    await waitFor(() => expect(iframe).toHaveAttribute('src', 'http://127.0.0.1:12345/add'));
  });

  test('respects the auto-navigation lock for highlight target URLs', async () => {
    // Lock the preview URL so highlight target URLs do not override the current page. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', display: 'webview', status: 'running', port: 12345, path: '/preview/g1/frontend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const iframe = await screen.findByTitle('frontend');
    const lockButton = await screen.findByLabelText('Lock auto navigation');
    fireEvent.click(lockButton);

    const sources = (globalThis as any).__eventSourceInstances ?? [];
    const highlightSource = sources.find((source: any) =>
      decodeURIComponent(String(source.url)).includes('preview-highlight:g1')
    );
    expect(highlightSource).toBeTruthy();
    highlightSource.emit('preview.highlight', {
      data: JSON.stringify({
        taskGroupId: 'g1',
        instanceName: 'frontend',
        command: {
          selector: '.btn',
          targetUrl: '/add'
        },
        issuedAt: '2026-02-04T00:00:00.000Z'
      })
    });

    await waitFor(() => expect(iframe).toHaveAttribute('src', 'http://127.0.0.1:12345/'));
  });

  test('renders diagnostics when preview startup fails', async () => {
    // Validate Phase 3 diagnostics rendering for failed preview instances. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [
        {
          name: 'frontend',
          display: 'webview',
          status: 'failed',
          path: '/preview/g1/frontend/',
          diagnostics: {
            exitCode: 1,
            signal: null,
            logs: [
              {
                timestamp: '2026-01-12T00:00:00.000Z',
                level: 'stderr',
                message: 'boom'
              }
            ]
          }
        }
      ]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchTaskGroupPreviewStatus).toHaveBeenCalled());
    // Preview diagnostics should render once the failed preview is active. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    expect(await screen.findByText('Startup diagnostics')).toBeInTheDocument();
    expect(screen.getByText(/Exit code/i)).toHaveTextContent('Exit code: 1');
    expect(screen.getByText('Latest logs')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  // Verify preview start modal exposes manual dependency reinstall + auto-start behavior. docs/en/developer/plans/b0lmcv9gkmu76vryzkjt/task_plan.md b0lmcv9gkmu76vryzkjt
  test('auto-starts preview after dependency reinstall', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', display: 'webview', status: 'stopped', path: '/preview/g1/frontend/' }]
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchTaskGroupPreviewStatus).toHaveBeenCalled());
    const startButton = await screen.findByRole('button', { name: 'Start preview' });
    await ui.click(startButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Start preview', { selector: '.ant-modal-title' })).toBeInTheDocument();
    const reinstallButton = within(dialog).getByRole('button', { name: /Reinstall dependencies/i });
    await ui.click(reinstallButton);

    await waitFor(() => expect(api.installTaskGroupPreviewDependencies).toHaveBeenCalledWith('g1'));
    await waitFor(() => expect(api.startTaskGroupPreview).toHaveBeenCalledWith('g1'));
  });
});
