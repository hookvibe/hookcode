import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutionTimeline } from '../components/execution/ExecutionTimeline';
import type { ExecutionItem } from '../utils/executionLog';

// Verify the ThoughtChain-based structured execution log renderer. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5

describe('ExecutionTimeline', () => {
  test('renders structured items via ThoughtChain + Think (default-collapsed details, caret toggles)', async () => {
    const user = userEvent.setup();
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

    expect(container.querySelector('.hc-exec-thought-chain')).toBeTruthy();
    expect(container.querySelector('.hc-exec-item')).toBeNull();

    // The command should not be duplicated in title/description/content. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
    expect(screen.getAllByText('echo hi')).toHaveLength(1);

    await user.click(screen.getByText('echo hi'));
    expect(await screen.findByText('hi')).toBeInTheDocument();

    await user.click(screen.getByText('a.txt'));
    expect(await screen.findByText('diff --git a/a.txt b/a.txt')).toBeInTheDocument();
  });

  test('does not crash when filtered items change from empty to non-empty', () => {
    // Prevent hook-order crashes when streaming updates change the filtered list over time. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
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
    expect(container.querySelector('.hc-exec-thought-chain')).toBeTruthy();
  });
});
