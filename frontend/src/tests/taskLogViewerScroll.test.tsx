import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { TaskLogViewer } from '../components/TaskLogViewer';
import { fetchTaskLogsPage } from '../api';

// Mock the log pagination API to verify "load earlier" behavior. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
vi.mock('../api', async () => {
  const actual = await vi.importActual<any>('../api');
  return { ...actual, fetchTaskLogsPage: vi.fn() };
});

describe('TaskLogViewer auto-scroll', () => {
  test('keeps the nearest scroll container pinned to bottom on new logs', async () => {
    // Make the auto-scroll scheduling deterministic for tests. docs/en/developer/plans/xyaw6rrnebdb2uyuuv4a/task_plan.md xyaw6rrnebdb2uyuuv4a
    const originalRaf = globalThis.requestAnimationFrame;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0 as any;
    });

    try {
      const view = render(
        <div data-testid="scroller" style={{ overflowY: 'auto', height: 200 }}>
          <AntdApp>
            <TaskLogViewer taskId="t1" tail={2} variant="flat" />
          </AntdApp>
        </div>
      );

      await waitFor(() => expect((globalThis as any).__eventSourceInstances?.length ?? 0).toBe(1));

      const scroller = view.container.querySelector('[data-testid="scroller"]') as HTMLElement | null;
      expect(scroller).toBeTruthy();
      if (!scroller) return;

      Object.defineProperty(scroller, 'scrollHeight', { value: 600, configurable: true });
      Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true });
      scroller.scrollTop = 380; // within the "at bottom" threshold (< 24px remaining)
      scroller.dispatchEvent(new Event('scroll'));

      const es = (globalThis as any).__eventSourceInstances[0];
      // Emit init payload with sequence metadata for paged task logs. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      es.emit('init', { data: JSON.stringify({ logs: ['line 1', 'line 2', 'line 3'], startSeq: 1, endSeq: 3 }) });

      await waitFor(() => expect(scroller.scrollTop).toBe(400));
    } finally {
      vi.unstubAllGlobals();
      if (originalRaf) {
        globalThis.requestAnimationFrame = originalRaf;
      }
    }
  });
});

describe('TaskLogViewer reasoning visibility', () => {
  test('shows reasoning items in dialog-style logs by default', async () => {
    // Validate reasoning visibility in the dialog-style log renderer. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    render(
      <AntdApp>
        <TaskLogViewer taskId="t_reasoning" tail={2} variant="flat" />
      </AntdApp>
    );

    await waitFor(() => expect((globalThis as any).__eventSourceInstances?.length ?? 0).toBe(1));

    const es = (globalThis as any).__eventSourceInstances[0];
    // Provide seq metadata so log viewer can track paging state. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    es.emit('init', {
      data: JSON.stringify({
        logs: [
          JSON.stringify({
            type: 'item.completed',
            item: { id: 'r1', type: 'reasoning', text: 'why this matters' }
          })
        ],
        startSeq: 1,
        endSeq: 1
      })
    });

    const matches = await screen.findAllByText('why this matters');
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('TaskLogViewer pagination', () => {
  test('requests earlier log pages when available', async () => {
    // Stub paged log response for the "load earlier" action. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    vi.mocked(fetchTaskLogsPage).mockResolvedValue({
      logs: ['older line'],
      startSeq: 1,
      endSeq: 1,
      nextBefore: null
    });

    render(
      <AntdApp>
        <TaskLogViewer taskId="t_paged" tail={2} />
      </AntdApp>
    );

    await waitFor(() => expect((globalThis as any).__eventSourceInstances?.length ?? 0).toBe(1));

    const es = (globalThis as any).__eventSourceInstances[0];
    es.emit('init', {
      data: JSON.stringify({ logs: ['newer line'], startSeq: 2, endSeq: 2, nextBefore: 2 })
    });

    const button = await screen.findByRole('button', { name: /加载更早|Load earlier/i }); // Match i18n label for load-earlier control. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    button.click();

    await waitFor(() =>
      expect(fetchTaskLogsPage).toHaveBeenCalledWith('t_paged', { before: 2, limit: 2 })
    );
  });
});

describe('TaskLogViewer workspace snapshots', () => {
  test('renders workspace change panels from live SSE snapshot logs', async () => {
    // Verify SSE snapshot events update the dedicated worker diff panel without waiting for a task-detail refetch. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    render(
      <AntdApp>
        <TaskLogViewer taskId="t_workspace" tail={2} variant="flat" />
      </AntdApp>
    );

    await waitFor(() => expect((globalThis as any).__eventSourceInstances?.length ?? 0).toBe(1));

    const es = (globalThis as any).__eventSourceInstances[0];
    es.emit('init', {
      data: JSON.stringify({ logs: [], startSeq: 0, endSeq: 0 })
    });
    es.emit('log', {
      data: JSON.stringify({
        seq: 1,
        line: JSON.stringify({
          type: 'hookcode.workspace.snapshot',
          snapshot: {
            capturedAt: '2026-03-16T09:45:00.000Z',
            files: [
              {
                path: 'src/live.ts',
                kind: 'update',
                unifiedDiff: 'diff --git a/src/live.ts b/src/live.ts',
                oldText: 'const ready = false;\n',
                newText: 'const ready = true;\n',
                diffHash: 'live-hash',
                updatedAt: '2026-03-16T09:45:00.000Z'
              }
            ]
          }
        })
      })
    });

    expect(await screen.findByText(/工作区变更|Workspace changes/i)).toBeInTheDocument();
    expect((await screen.findAllByText('src/live.ts')).length).toBeGreaterThan(0);
    expect(
      await screen.findByText((_content, node) => node?.textContent === 'const ready = true;')
    ).toBeInTheDocument();
    expect(screen.queryByText(/hookcode\.workspace\.snapshot/i)).toBeNull();
  });
});
