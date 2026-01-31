import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ExecutionTimeline } from '../components/execution/ExecutionTimeline';
import { setLocale } from '../i18n';
import type { ExecutionItem } from '../utils/executionLog';

// Verify the dialog-style execution log renderer without ThoughtChain. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128

describe('ExecutionTimeline', () => {
  beforeEach(() => {
    // Force a stable locale so labels remain predictable in snapshots/assertions. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    setLocale('en-US');
  });

  test('renders dialog rows with work areas for commands and file changes', () => {
    // Validate work-area sections render inline without expand/collapse controls. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    const items: ExecutionItem[] = [
      {
        kind: 'command_execution',
        id: 'cmd_1',
        status: 'completed',
        command: 'echo hi',
        exitCode: 0,
        output: 'hi'
      },
      {
        kind: 'file_change',
        id: 'fc_1',
        status: 'completed',
        changes: [{ path: '/tmp/a.txt', kind: 'update' }],
        diffs: [{ path: 'a.txt', kind: 'update', unifiedDiff: 'diff --git a/a.txt b/a.txt' }]
      }
    ];

    const { container } = render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    expect(container.querySelector('.hc-exec-dialog')).toBeTruthy();
    expect(screen.getAllByText(/echo hi/)).toHaveLength(1);
    expect(screen.getByText('Command output')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getAllByText('Files').length).toBeGreaterThan(0);
    expect(screen.getByText('Diffs')).toBeInTheDocument();
    expect(screen.getByText('diff --git a/a.txt b/a.txt')).toBeInTheDocument();
  });

  test('does not crash when filtered items change from empty to non-empty', () => {
    // Prevent hook-order crashes when streaming updates change the filtered list over time. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    const reasoningOnly: ExecutionItem[] = [
      {
        kind: 'reasoning',
        id: 'r_1',
        status: 'completed',
        text: 'internal'
      }
    ];

    const { container, rerender } = render(<ExecutionTimeline items={reasoningOnly} showReasoning={false} wrapDiffLines showLineNumbers />);
    expect(container.querySelector('.hc-exec-empty')).toBeTruthy();

    const withVisible: ExecutionItem[] = [
      ...reasoningOnly,
      {
        kind: 'command_execution',
        id: 'c_1',
        status: 'completed',
        command: 'echo ok',
        exitCode: 0,
        output: 'ok'
      }
    ];

    expect(() =>
      rerender(<ExecutionTimeline items={withVisible} showReasoning={false} wrapDiffLines showLineNumbers />)
    ).not.toThrow();
    expect(container.querySelector('.hc-exec-dialog')).toBeTruthy();
  });

  test('renders todo_list items with completion markers', () => {
    // Validate todo_list rendering to avoid "unknown event" fallbacks. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    const items: ExecutionItem[] = [
      {
        kind: 'todo_list',
        id: 'todo_1',
        status: 'in_progress',
        items: [
          { text: 'First task', completed: false },
          { text: 'Second task', completed: true }
        ]
      }
    ];

    const { container } = render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();
    expect(container.querySelector('.hc-exec-dialog__todo-item.is-complete')).toBeTruthy();
  });

  test('shows a running indicator when any item is in progress', () => {
    // Surface the bottom running marker while execution is active. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    const items: ExecutionItem[] = [
      {
        kind: 'command_execution',
        id: 'cmd_running',
        status: 'in_progress',
        command: 'echo running',
        output: ''
      }
    ];

    const { container } = render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    const running = container.querySelector('.hc-exec-running');
    expect(running).toBeTruthy();
    if (running) {
      expect(within(running).getByText('Running')).toBeInTheDocument();
    }
  });
});
