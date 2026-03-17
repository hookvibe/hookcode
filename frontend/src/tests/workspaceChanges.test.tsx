import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskWorkspaceChangesPanel } from '../components/tasks/TaskWorkspaceChangesPanel';
import { extractLatestWorkspaceChangesFromLogs, parseWorkspaceSnapshotLogLine } from '../utils/workspaceChanges';

const snapshot = {
  capturedAt: '2026-03-16T09:30:00.000Z',
  files: [
    {
      path: 'src/first.ts',
      kind: 'update' as const,
      unifiedDiff: 'diff --git a/src/first.ts b/src/first.ts',
      oldText: 'const value = 1;\n',
      newText: 'const value = 2;\n',
      diffHash: 'first-hash',
      updatedAt: '2026-03-16T09:30:00.000Z'
    },
    {
      path: 'src/second.ts',
      kind: 'create' as const,
      unifiedDiff: 'diff --git a/src/second.ts b/src/second.ts',
      oldText: undefined,
      newText: 'export const second = true;\n',
      diffHash: 'second-hash',
      updatedAt: '2026-03-16T09:30:00.000Z'
    }
  ]
};

describe('workspaceChanges utils', () => {
  test('parses the latest workspace snapshot from raw task log lines', () => {
    // Parse worker snapshot log lines so the task log viewer can hydrate file diff panels without an API refetch. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const line = JSON.stringify({ type: 'hookcode.workspace.snapshot', snapshot });
    expect(parseWorkspaceSnapshotLogLine(line)).toEqual(snapshot);
    expect(
      extractLatestWorkspaceChangesFromLogs([
        'plain log line',
        JSON.stringify({ type: 'hookcode.workspace.snapshot', snapshot: null }),
        line
      ])
    ).toEqual(snapshot);
  });
});

describe('TaskWorkspaceChangesPanel', () => {
  test('renders file badges and shows the first diff by default', () => {
    // Keep a diff visible by default so the new ClaudeCodeUI-style panel is useful as soon as worker snapshots arrive. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    render(<TaskWorkspaceChangesPanel changes={snapshot} />);

    expect(screen.getByText(/工作区变更|Workspace changes/i)).toBeInTheDocument();
    expect(screen.getAllByText('src/first.ts').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/修改|Edited/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/新增|New/i)).toBeInTheDocument();
    expect(
      screen.getByText((_content, node) => node?.textContent === 'const value = 2;')
    ).toBeInTheDocument();
    // Surface compact +/- summaries so the file rail mirrors the Claude-style change magnitude cues. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    expect(screen.getAllByText('+1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-1').length).toBeGreaterThan(0);
  });

  test('switches the active diff when another file is selected from the file rail', () => {
    // Keep the compact file rail interactive so the Claude-style panel can inspect any changed file without leaving the execution area. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    render(<TaskWorkspaceChangesPanel changes={snapshot} />);

    fireEvent.click(screen.getByRole('button', { name: 'src/second.ts' }));

    // Match the rendered diff content without depending on a single DOM depth because the compact viewer nests content/text spans. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    expect(screen.getByRole('button', { name: 'src/second.ts' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getAllByText((_content, node) => node?.textContent === 'export const second = true;').length
    ).toBeGreaterThan(0);
  });

  test('supports keyboard navigation across the file rail', () => {
    // Keep the dense file rail accessible when worker runs touch many files and the Claude-style panel needs fast keyboard inspection. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    render(<TaskWorkspaceChangesPanel changes={snapshot} />);

    const firstFile = screen.getByRole('button', { name: 'src/first.ts' });
    fireEvent.keyDown(firstFile, { key: 'ArrowRight' });

    expect(screen.getByRole('button', { name: 'src/second.ts' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getAllByText((_content, node) => node?.textContent === 'export const second = true;').length
    ).toBeGreaterThan(0);
  });

  test('keeps full paths accessible while rendering compact trailing path segments', () => {
    // Preserve the actionable filename in dense Claude-style cards, but expose the full path via title so deep repo paths remain inspectable. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const longPathSnapshot = {
      ...snapshot,
      files: [
        {
          ...snapshot.files[0],
          path: 'apps/dashboard/src/features/workers/very/deep/file-name.tsx'
        }
      ]
    };

    render(<TaskWorkspaceChangesPanel changes={longPathSnapshot} />);

    const compactPathNodes = screen.getAllByText((_content, node) => node?.textContent === '.../very/deep/file-name.tsx');
    expect(compactPathNodes.length).toBeGreaterThan(0);
    expect(
      compactPathNodes.some((node) => node.getAttribute('title') === 'apps/dashboard/src/features/workers/very/deep/file-name.tsx')
    ).toBe(true);
  });

  test('limits large inline diffs by default and lets the user expand them explicitly', () => {
    // Bound giant worker diffs on first render so the task execution surface stays responsive, but keep an explicit escape hatch for full inspection. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const oldText = Array.from({ length: 905 }, (_, index) => `line ${index + 1}`).join('\n');
    const newText = Array.from({ length: 905 }, (_, index) => (index === 904 ? 'line 905 updated' : `line ${index + 1}`)).join('\n');

    render(
      <TaskWorkspaceChangesPanel
        changes={{
          capturedAt: snapshot.capturedAt,
          files: [
            {
              path: 'src/large.ts',
              kind: 'update',
              unifiedDiff: '',
              oldText,
              newText,
              diffHash: 'large-hash',
              updatedAt: snapshot.capturedAt
            }
          ]
        }}
      />
    );

    expect(screen.getByText(/大 diff 预览|Large diff preview/i)).toBeInTheDocument();
    expect(screen.queryByText((_content, node) => node?.textContent === 'line 905 updated')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /显示完整 diff|Show full diff/i }));

    expect(screen.getByText((_content, node) => node?.textContent === 'line 905 updated')).toBeInTheDocument();
  });
});
