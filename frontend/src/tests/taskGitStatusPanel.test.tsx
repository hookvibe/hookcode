// Validate compact git status cards collapse by default and expand on demand in task-group chat. docs/en/developer/plans/taskgroup-gitstatus-compact-20260303/task_plan.md taskgroup-gitstatus-compact-20260303

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../i18n';
import { TaskGitStatusPanel } from '../components/tasks/TaskGitStatusPanel';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    pushTaskGitChanges: vi.fn(async () => ({ result: { gitStatus: null } }))
  };
});

const buildTask = () =>
  ({
    id: 't1',
    repoProvider: 'gitlab',
    permissions: { canManage: true },
    result: {
      repoWorkflow: {
        mode: 'fork',
        upstream: { webUrl: 'https://example.com/upstream.git' },
        fork: { webUrl: 'https://example.com/fork.git' }
      },
      gitStatus: {
        enabled: true,
        final: {
          branch: 'feature/compact-git-card',
          headSha: '1234567890abcdef1234567890abcdef12345678',
          ahead: 2,
          behind: 1
        },
        baseline: {
          branch: 'main',
          headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        },
        delta: {
          headChanged: true,
          branchChanged: true
        },
        push: {
          status: 'unpushed'
        },
        workingTree: {
          staged: ['src/a.ts'],
          unstaged: ['src/b.ts'],
          untracked: ['src/c.ts']
        }
      }
    }
  }) as any;

const renderPanel = (variant: 'compact' | 'full') =>
  render(
    <AntdApp>
      <TaskGitStatusPanel task={buildTask()} variant={variant} />
    </AntdApp>
  );

describe('TaskGitStatusPanel', () => {
  beforeEach(() => {
    setLocale('en-US');
  });

  test('keeps compact variant collapsed by default with summary-only content', async () => {
    renderPanel('compact');

    expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument();
    expect(screen.getByText('feature/compact-git-card')).toBeInTheDocument();
    expect(screen.getByText('2 ahead · 1 behind')).toBeInTheDocument();
    expect(screen.getByText('1 staged · 1 unstaged · 1 untracked')).toBeInTheDocument();
    expect(screen.queryByText('Staged (1)')).not.toBeInTheDocument();
  });

  test('expands compact variant when user requests details', async () => {
    const ui = userEvent.setup();
    renderPanel('compact');

    await ui.click(screen.getByRole('button', { name: /show details/i }));

    expect(screen.getByRole('button', { name: /hide details/i })).toBeInTheDocument();
    expect(screen.getByText('Staged (1)')).toBeInTheDocument();
    expect(screen.getByText('src/a.ts')).toBeInTheDocument();
    expect(screen.getByText('Unstaged (1)')).toBeInTheDocument();
    expect(screen.getByText('Untracked (1)')).toBeInTheDocument();
  });

  test('keeps full variant expanded without compact toggles', () => {
    renderPanel('full');

    expect(screen.queryByRole('button', { name: /show details/i })).not.toBeInTheDocument();
    expect(screen.getByText('Staged (1)')).toBeInTheDocument();
    expect(screen.queryByText('1 staged · 1 unstaged · 1 untracked')).not.toBeInTheDocument();
  });
});
