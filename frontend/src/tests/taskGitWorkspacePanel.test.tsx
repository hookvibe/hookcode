import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { TaskGitWorkspacePanel } from '../components/tasks/TaskGitWorkspacePanel';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  __esModule: true,
  fetchTaskWorkspace: vi.fn(async () => ({
    source: 'worker',
    live: true,
    readOnly: false,
    capturedAt: '2026-03-17T09:00:00.000Z',
    branch: 'feature/demo',
    headSha: '1234567890abcdef',
    workingTree: { staged: ['src/app.ts'], unstaged: [], untracked: [] },
    summary: { total: 1, staged: 1, unstaged: 0, untracked: 0, additions: 4, deletions: 1, hasChanges: true },
    files: [
      {
        path: 'src/app.ts',
        kind: 'update',
        sections: ['staged'],
        unifiedDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")\n',
        oldText: 'console.log("old")\n',
        newText: 'console.log("new")\n',
        diffHash: 'hash-1',
        updatedAt: '2026-03-17T09:00:00.000Z'
      }
    ],
    canCommit: true
  })),
  runTaskWorkspaceOperation: vi.fn(async (_taskId: string, action: string, input?: { message?: string }) => ({
    workspace: {
      source: 'worker',
      live: true,
      readOnly: false,
      capturedAt: '2026-03-17T09:01:00.000Z',
      branch: 'feature/demo',
      headSha: action === 'commit' ? 'abcdef1234567890' : '1234567890abcdef',
      workingTree: { staged: action === 'commit' ? [] : ['src/app.ts'], unstaged: [], untracked: [] },
      summary: {
        total: action === 'commit' ? 0 : 1,
        staged: action === 'commit' ? 0 : 1,
        unstaged: 0,
        untracked: 0,
        additions: action === 'commit' ? 0 : 4,
        deletions: action === 'commit' ? 0 : 1,
        hasChanges: action !== 'commit'
      },
      files:
        action === 'commit'
          ? []
          : [
              {
                path: 'src/app.ts',
                kind: 'update',
                sections: ['staged'],
                unifiedDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")\n',
                oldText: 'console.log("old")\n',
                newText: 'console.log("new")\n',
                diffHash: 'hash-1',
                updatedAt: '2026-03-17T09:01:00.000Z'
              }
            ],
      canCommit: action !== 'commit'
    },
    commit: action === 'commit' ? { sha: 'abcdef1234567890', message: input?.message ?? '', committedAt: '2026-03-17T09:01:00.000Z' } : undefined
  })),
  pushTaskGitChanges: vi.fn(async () => ({
    id: 'task-1',
    eventType: 'chat',
    title: 'Task 1',
    status: 'failed',
    retries: 0,
    createdAt: '2026-03-17T09:00:00.000Z',
    updatedAt: '2026-03-17T09:01:00.000Z',
    permissions: { canManage: true }
  }))
}));

const baseTask = {
  id: 'task-1',
  eventType: 'chat',
  title: 'Task 1',
  status: 'failed',
  retries: 0,
  createdAt: '2026-03-17T09:00:00.000Z',
  updatedAt: '2026-03-17T09:00:00.000Z',
  permissions: { canManage: true },
  result: {
    gitStatus: {
      enabled: true,
      push: { status: 'not_applicable' }
    }
  }
} as const;

const buildSingleFileWorkspace = () => ({
  source: 'worker',
  live: true,
  readOnly: false,
  capturedAt: '2026-03-17T09:00:00.000Z',
  branch: 'feature/demo',
  headSha: '1234567890abcdef',
  workingTree: { staged: ['src/app.ts'], unstaged: [], untracked: [] },
  summary: { total: 1, staged: 1, unstaged: 0, untracked: 0, additions: 4, deletions: 1, hasChanges: true },
  files: [
    {
      path: 'src/app.ts',
      kind: 'update',
      sections: ['staged'],
      unifiedDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")\n',
      oldText: 'console.log("old")\n',
      newText: 'console.log("new")\n',
      diffHash: 'hash-1',
      updatedAt: '2026-03-17T09:00:00.000Z'
    }
  ],
  canCommit: true
});

const buildMultiFileWorkspace = () => ({
  source: 'snapshot',
  live: false,
  readOnly: false,
  capturedAt: '2026-03-17T09:00:00.000Z',
  branch: 'feature/demo',
  headSha: '1234567890abcdef',
  upstream: 'origin/main',
  ahead: 2,
  behind: 1,
  workingTree: { staged: ['src/app.ts'], unstaged: ['src/feature.ts'], untracked: ['src/new.ts'] },
  summary: { total: 3, staged: 1, unstaged: 1, untracked: 1, additions: 8, deletions: 2, hasChanges: true },
  files: [
    {
      path: 'src/app.ts',
      kind: 'update',
      sections: ['staged'],
      unifiedDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")\n',
      oldText: 'console.log("old")\n',
      newText: 'console.log("new")\n',
      diffHash: 'hash-1',
      updatedAt: '2026-03-17T09:00:00.000Z'
    },
    {
      path: 'src/feature.ts',
      kind: 'update',
      sections: ['unstaged'],
      unifiedDiff: '@@ -1,1 +1,2 @@\n-export {}\n+export const value = 1\n',
      oldText: 'export {}\n',
      newText: 'export const value = 1\n',
      diffHash: 'hash-2',
      updatedAt: '2026-03-17T09:00:00.000Z'
    },
    {
      path: 'src/new.ts',
      kind: 'create',
      sections: ['untracked'],
      unifiedDiff: '@@ -0,0 +1,1 @@\n+export const created = true\n',
      oldText: '',
      newText: 'export const created = true\n',
      diffHash: 'hash-3',
      updatedAt: '2026-03-17T09:00:00.000Z'
    }
  ],
  canCommit: true
});

describe('TaskGitWorkspacePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.localStorage.clear();
    vi.mocked(api.fetchTaskWorkspace).mockResolvedValue(buildSingleFileWorkspace() as any);
  });

  test('renders staged files, suggests a commit message, and commits', async () => {
    const ui = userEvent.setup();
    render(
      <AntdApp>
        <TaskGitWorkspacePanel task={baseTask as any} />
      </AntdApp>
    );

    expect((await screen.findAllByText('src/app.ts')).length).toBeGreaterThan(0);
    expect(await screen.findByText('feature/demo')).toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: 'Suggest message' }));
    expect(screen.getByPlaceholderText('Write a commit message')).toHaveValue('Update app.ts');
    await waitFor(() => expect(window.localStorage.getItem('hookcode:task-workspace-commit:task-1')).toBe('Update app.ts'));

    await ui.click(screen.getByRole('button', { name: /Commit/i }));
    expect(await screen.findByText('Create a commit from 1 staged files?')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() =>
      expect(api.runTaskWorkspaceOperation).toHaveBeenCalledWith('task-1', 'commit', { message: 'Update app.ts' })
    );
    await waitFor(() => expect(window.localStorage.getItem('hookcode:task-workspace-commit:task-1')).toBeNull());
  });

  test('stages only the selected files from the rail', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTaskWorkspace).mockResolvedValue(buildMultiFileWorkspace() as any);

    render(
      <AntdApp>
        <TaskGitWorkspacePanel task={baseTask as any} />
      </AntdApp>
    );

    await screen.findByText('src/feature.ts');
    await ui.click(screen.getByLabelText('Select src/feature.ts'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await ui.click(screen.getAllByRole('button', { name: /Stage selected/i })[0]);

    await waitFor(() =>
      expect(api.runTaskWorkspaceOperation).toHaveBeenCalledWith('task-1', 'stage', { paths: ['src/feature.ts'] })
    );
  });

  test('renders legend badges and inline diff previews in the file rail', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTaskWorkspace).mockResolvedValue(buildMultiFileWorkspace() as any);

    render(
      <AntdApp>
        <TaskGitWorkspacePanel task={baseTask as any} />
      </AntdApp>
    );

    await screen.findByText('src/feature.ts');
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Modified')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();

    const featureRow = screen.getAllByText('src/feature.ts')[0].closest('.hc-git-workspace__file');
    expect(featureRow).toBeTruthy();

    await ui.click(within(featureRow as HTMLElement).getByRole('button', { name: /Preview/i }));

    expect(
      within(featureRow as HTMLElement).getByText((content) => content.includes('+export const value = 1'))
    ).toBeInTheDocument();
  });

  test('confirms push before sending changes', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTaskWorkspace).mockResolvedValue(buildMultiFileWorkspace() as any);

    render(
      <AntdApp>
        <TaskGitWorkspacePanel
          task={{
            ...baseTask,
            result: {
              repoWorkflow: { mode: 'fork' },
              gitStatus: {
                enabled: true,
                push: { status: 'unpushed' }
              }
            }
          } as any}
        />
      </AntdApp>
    );

    await screen.findByText('Push');
    await ui.click(screen.getByText('Push'));
    expect(await screen.findByText('Push feature/demo to origin/main?')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(api.pushTaskGitChanges).toHaveBeenCalledWith('task-1'));
  });
});
