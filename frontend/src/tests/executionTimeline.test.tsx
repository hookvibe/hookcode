import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutionTimeline } from '../components/execution/ExecutionTimeline';
import { setLocale } from '../i18n';
import type { ExecutionItem } from '../utils/executionLog';

// Verify the dialog-style execution log renderer without ThoughtChain. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128

describe('ExecutionTimeline', () => {
  beforeEach(() => {
    // Force a stable locale so labels remain predictable in snapshots/assertions. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    setLocale('en-US');
  });

  test('renders dialog rows with work areas for commands and file changes', async () => {
    // Use user events to expand the new collapsible sections. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const ui = userEvent.setup();
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

    // Match updated execution timeline layout classes after the style refresh. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(container.querySelector('.chat-stream')).toBeTruthy();
    expect(screen.getAllByText(/echo hi/)).toHaveLength(1);
    const outputToggle = screen.getByRole('button', { name: 'Command output' });
    await ui.click(outputToggle);
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getByText('/tmp/a.txt')).toBeInTheDocument();
    const diffToggle = screen.getByRole('button', { name: 'Diffs' });
    await ui.click(diffToggle);
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
    // Keep empty-state selector aligned with the new chat timeline layout. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(container.querySelector('.chat-empty')).toBeTruthy();

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
    expect(container.querySelector('.chat-stream')).toBeTruthy();
  });

  test('renders todo_list items with completion markers', () => {
    // Validate todo_list rendering to avoid "unknown event" fallbacks. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    const items: ExecutionItem[] = [
      {
        kind: 'todo_list',
        id: 'todo_1',
        status: 'in_progress',
        items: [
          { id: 'todo_a', content: 'First task', status: 'in_progress', priority: 'high' },
          { id: 'todo_b', content: 'Second task', status: 'completed', priority: 'low' }
        ]
      }
    ];

    const { container } = render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    // Verify the updated todo item class names in the refreshed execution UI. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(container.querySelector('.chat-todo__item.is-complete')).toBeTruthy();
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

    // Assert running indicator with the new chat-running class. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const running = container.querySelector('.chat-running');
    expect(running).toBeTruthy();
    if (running) {
      expect(within(running).getByText('Running')).toBeInTheDocument();
    }
  });

  test('renders localized file pills and compact +/- summaries for file changes', async () => {
    // Keep the compact timeline file rows aligned with the Claude-style workspace panel by showing localized change pills and derived +/- counts. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const ui = userEvent.setup();
    const items: ExecutionItem[] = [
      {
        kind: 'file_change',
        id: 'fc_stats',
        status: 'completed',
        changes: [{ path: 'src/example.ts', kind: 'update' }],
        diffs: [
          {
            path: 'src/example.ts',
            kind: 'update',
            unifiedDiff: 'diff --git a/src/example.ts b/src/example.ts',
            oldText: 'const ready = false;\n',
            newText: 'const ready = true;\nconst extra = 1;\n'
          }
        ]
      }
    ];

    render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Diffs' }));
    expect(screen.getAllByText('+2').length).toBeGreaterThan(0);
  });

  test('only shows status badges for failed items', () => {
    // Hide non-failure status badges to reduce chat noise while still surfacing failures. docs/en/developer/plans/chat-message-status-20260305/task_plan.md chat-message-status-20260305
    const items: ExecutionItem[] = [
      { kind: 'agent_message', id: 'msg_ok', status: 'completed', text: 'ok' },
      { kind: 'agent_message', id: 'msg_fail', status: 'failed', text: 'boom' }
    ];

    const { container } = render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    expect(container.querySelector('.chat-bubble__status.is-completed')).toBeNull();
    const failedBadge = container.querySelector('.chat-bubble__status.is-failed');
    expect(failedBadge).toBeTruthy();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  test('caps oversized command output previews until the user expands them', async () => {
    // Keep huge command outputs from flooding the dialog DOM on first open while still allowing an explicit full-content inspection path. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const ui = userEvent.setup();
    const output = Array.from({ length: 190 }, (_, index) => `output line ${index + 1}`).join('\n');
    const items: ExecutionItem[] = [
      {
        kind: 'command_execution',
        id: 'cmd_big',
        status: 'completed',
        command: 'cat massive.log',
        output
      }
    ];

    const { container } = render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    await ui.click(screen.getByRole('button', { name: 'Command output' }));
    expect(screen.getByText(/Showing 180\/190 lines|仅展示 180\/190 行/i)).toBeInTheDocument();
    const outputBlock = container.querySelector('.chat-work__mono');
    expect(outputBlock).toBeTruthy();
    expect(outputBlock).not.toHaveTextContent('output line 190');

    await ui.click(screen.getByRole('button', { name: 'Show full content' }));

    expect(outputBlock).toHaveTextContent('output line 190');
  });

  test('renders raw tool input details for command tools', async () => {
    const ui = userEvent.setup();
    const items: ExecutionItem[] = [
      {
        kind: 'command_execution',
        id: 'cmd_edit',
        status: 'completed',
        toolName: 'Edit',
        toolInput: {
          file_path: 'src/example.ts',
          old_string: 'const value = 1;',
          new_string: 'const value = 2;'
        },
        output: 'updated'
      }
    ];

    const { container } = render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    expect(container.querySelector('.chat-bubble.kind-command_execution.tool-edit')).toBeTruthy();
    await ui.click(screen.getByRole('button', { name: 'Tool input' }));
    expect(screen.getByText(/"file_path": "src\/example\.ts"/)).toBeInTheDocument();
  });

  test('switches between diff tabs for multi-file tool changes', async () => {
    const ui = userEvent.setup();
    const items: ExecutionItem[] = [
      {
        kind: 'file_change',
        id: 'fc_tabs',
        status: 'completed',
        changes: [
          { path: 'src/first.ts', kind: 'update' },
          { path: 'src/second.ts', kind: 'update' }
        ],
        diffs: [
          { path: 'src/first.ts', kind: 'update', unifiedDiff: 'first diff content' },
          { path: 'src/second.ts', kind: 'update', unifiedDiff: 'second diff content' }
        ]
      }
    ];

    render(<ExecutionTimeline items={items} showReasoning wrapDiffLines showLineNumbers />);

    await ui.click(screen.getByRole('button', { name: 'Diffs' }));
    expect(screen.getByText('first diff content')).toBeInTheDocument();

    await ui.click(screen.getByRole('tab', { name: 'src/second.ts' }));
    expect(screen.getByText('second diff content')).toBeInTheDocument();
  });
});
