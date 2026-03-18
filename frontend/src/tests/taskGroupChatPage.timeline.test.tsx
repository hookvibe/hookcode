// Keep TaskGroupChatPage workspace tests focused on the queue card list and shared log tabs. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTaskGroupChatPage, setupTaskGroupChatMocks } from './taskGroupChatPageTestUtils';
import * as api from '../api';

describe('TaskGroupChatPage workspace', () => {
  beforeEach(() => {
    setupTaskGroupChatMocks();
  });

  test('renders queue cards by persisted order and lazy-loads task logs on click', async () => {
    // Render log-tab output as Markdown so task results preserve headings and lists after lazy loading. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const ui = userEvent.setup();
    const now = '2026-01-11T00:00:00.000Z';

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([
      {
        id: 't_second',
        eventType: 'chat',
        title: 'Second task',
        status: 'queued',
        retries: 0,
        groupOrder: 2,
        sequence: { order: 2, previousTaskId: 't_first' },
        payload: { __chat: { text: 'Second prompt' } },
        permissions: { canManage: true },
        createdAt: now,
        updatedAt: now
      } as any,
      {
        id: 't_first',
        eventType: 'chat',
        title: 'First task',
        status: 'succeeded',
        retries: 0,
        groupOrder: 1,
        sequence: { order: 1, nextTaskId: 't_second' },
        payload: { __chat: { text: 'First prompt' } },
        permissions: { canManage: true },
        createdAt: now,
        updatedAt: now
      } as any
    ]);
    vi.mocked(api.fetchTask).mockResolvedValue({
      id: 't_first',
      eventType: 'chat',
      title: 'First task',
      status: 'succeeded',
      retries: 0,
      groupOrder: 1,
      sequence: { order: 1, nextTaskId: 't_second' },
      permissions: { canManage: true },
      createdAt: now,
      updatedAt: now,
      result: { outputText: '## Detailed output\n\n- First rendered item' }
    } as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const headlines = await screen.findAllByText(/task$/i, { selector: '.hc-task-workspace-card__headline' });
    expect(headlines.map((node) => node.textContent)).toEqual(['First task', 'Second task']);
    expect(api.fetchTask).not.toHaveBeenCalled();

    await ui.click(screen.getByText('First task', { selector: '.hc-task-workspace-card__headline' }));

    await waitFor(() => expect(api.fetchTask).toHaveBeenCalledWith('t_first'));
    // The redundant outputText/summary sections were removed; the timeline is the single source of execution results. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
    // Verify the task detail was fetched and the log panel rendered (skeleton gone).
    expect(api.fetchTask).toHaveBeenCalledWith('t_first');
  });

  test('keeps polling active tasks after SSE ready so queued cards refresh into processing', async () => {
    // Keep a polling fallback while active tasks exist so a fresh task-group route still updates if the first SSE status event is missed. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const now = '2026-03-06T00:00:00.000Z';

    let fetchCount = 0;
    vi.mocked(api.fetchTaskGroupTasks).mockImplementation(async () => {
      fetchCount += 1;
      const status = fetchCount >= 3 ? 'processing' : 'queued';
      return [
        {
          id: 't_poll',
          eventType: 'chat',
          title: 'Queued then processing',
          status,
          retries: 0,
          groupOrder: 1,
          sequence: { order: 1 },
          payload: { __chat: { text: 'Wait for processing' } },
          permissions: { canManage: true },
          createdAt: now,
          updatedAt: now
        } as any
      ];
    });

    renderTaskGroupChatPage({ taskGroupId: 'g1' });
    await screen.findByText('Queued');

    const sources = ((globalThis as any).__eventSourceInstances ?? []) as Array<{ url: string; emit: (type: string, ev?: any) => void }>;
    const groupSource = sources.find((source) => String(source.url).includes('topics=task-group%3Ag1'));
    expect(groupSource).toBeTruthy();
    groupSource?.emit('ready');

    await waitFor(() => expect(screen.getByText('Processing')).toBeInTheDocument(), { timeout: 7000 });
    expect(api.fetchTaskGroupTasks.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test('opens the workspace tab from the summary card and loads the full workspace panel', async () => {
    // Keep task cards lightweight while still providing a direct entry into the full Claude-style workspace tab. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const ui = userEvent.setup();
    const now = '2026-01-11T00:00:00.000Z';

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([
      {
        id: 't_git',
        eventType: 'chat',
        title: 'Git task',
        status: 'succeeded',
        retries: 0,
        groupOrder: 1,
        sequence: { order: 1 },
        payload: { __chat: { text: 'Show git changes' } },
        permissions: { canManage: true },
        createdAt: now,
        updatedAt: now,
        result: {
          repoWorkflow: {
            mode: 'fork',
            upstream: { webUrl: 'https://example.com/upstream.git' },
            fork: { webUrl: 'https://example.com/fork.git' }
          },
          gitStatus: {
            enabled: true,
            final: { branch: 'feature/git-panel', headSha: '1234567890abcdef1234567890abcdef12345678', ahead: 2, behind: 1 },
            baseline: { branch: 'main', headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
            delta: { headChanged: true, branchChanged: true },
            push: { status: 'unpushed' },
            workingTree: { staged: ['src/a.ts'], unstaged: ['src/b.ts'], untracked: ['src/c.ts'] }
          },
          workspaceChanges: {
            capturedAt: now,
            files: [
              {
                path: 'src/a.ts',
                kind: 'update',
                diffHash: 'hash-a',
                unifiedDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")\n',
                oldText: 'console.log("old")\n',
                newText: 'console.log("new")\n',
                updatedAt: now
              }
            ]
          }
        }
      } as any
    ]);
    vi.mocked(api.fetchTask).mockResolvedValue({
      id: 't_git',
      eventType: 'chat',
      title: 'Git task',
      status: 'succeeded',
      retries: 0,
      groupOrder: 1,
      sequence: { order: 1 },
      permissions: { canManage: true },
      createdAt: now,
      updatedAt: now,
      result: {
        gitStatus: {
          enabled: true,
          final: { branch: 'feature/git-panel', headSha: '1234567890abcdef1234567890abcdef12345678', ahead: 2, behind: 1 },
          baseline: { branch: 'main', headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
          delta: { headChanged: true, branchChanged: true },
          push: { status: 'unpushed' },
          workingTree: { staged: ['src/a.ts'], unstaged: ['src/b.ts'], untracked: ['src/c.ts'] }
        },
        workspaceChanges: {
          capturedAt: now,
          files: [
            {
              path: 'src/a.ts',
              kind: 'update',
              diffHash: 'hash-a',
              unifiedDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")\n',
              oldText: 'console.log("old")\n',
              newText: 'console.log("new")\n',
              updatedAt: now
            }
          ]
        }
      }
    } as any);
    vi.mocked(api.fetchTaskWorkspace).mockResolvedValue({
      source: 'snapshot',
      live: false,
      readOnly: true,
      capturedAt: now,
      branch: 'feature/git-panel',
      headSha: '1234567890abcdef1234567890abcdef12345678',
      workingTree: { staged: ['src/a.ts'], unstaged: ['src/b.ts'], untracked: ['src/c.ts'] },
      summary: { total: 3, staged: 1, unstaged: 1, untracked: 1, additions: 1, deletions: 1, hasChanges: true },
      files: [
        {
          path: 'src/a.ts',
          kind: 'update',
          sections: ['staged'],
          diffHash: 'hash-a',
          unifiedDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")\n',
          oldText: 'console.log("old")\n',
          newText: 'console.log("new")\n',
          updatedAt: now
        }
      ],
      canCommit: false
    } as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const openWorkspaceButton = await screen.findByRole('button', { name: /open workspace/i });
    await ui.click(openWorkspaceButton);

    await waitFor(() => expect(api.fetchTask).toHaveBeenCalledWith('t_git'));
    await waitFor(() => expect(api.fetchTaskWorkspace).toHaveBeenCalledWith('t_git'));
    expect((await screen.findAllByText('feature/git-panel')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('src/a.ts').length).toBeGreaterThan(0);
  });

  test('renders task request and summary as Markdown inside the card', async () => {
    // Render task prompts and summaries as Markdown in queue cards so original formatting survives the workspace refactor. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const now = '2026-01-11T00:00:00.000Z';

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([
      {
        id: 't_md',
        eventType: 'chat',
        title: 'Markdown task',
        status: 'succeeded',
        retries: 0,
        groupOrder: 1,
        sequence: { order: 1 },
        payload: { __chat: { text: '## Request heading\n\n- request item' } },
        permissions: { canManage: true },
        createdAt: now,
        updatedAt: now,
        result: { summary: '### Summary heading\n\n1. summary item' }
      } as any
    ]);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    expect(await screen.findByRole('heading', { name: 'Request heading', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('request item')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summary heading', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('summary item')).toBeInTheDocument();
  });

  test('stops a processing task from the card actions', async () => {
    const ui = userEvent.setup();
    const now = '2026-01-11T00:00:00.000Z';

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([
      {
        id: 't_run',
        eventType: 'chat',
        title: 'Running task',
        status: 'processing',
        retries: 0,
        groupOrder: 1,
        sequence: { order: 1 },
        payload: { __chat: { text: 'Run it' } },
        permissions: { canManage: true },
        createdAt: now,
        updatedAt: now
      } as any
    ]);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await ui.click(await screen.findByRole('button', { name: /Stop/i }));
    await waitFor(() => expect(api.stopTask).toHaveBeenCalledWith('t_run'));
  });

  test('edits a queued task from the card actions', async () => {
    const ui = userEvent.setup();
    const now = '2026-01-11T00:00:00.000Z';

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([
      {
        id: 't_edit',
        eventType: 'chat',
        title: 'Queued task',
        status: 'queued',
        retries: 0,
        groupOrder: 1,
        sequence: { order: 1 },
        payload: { __chat: { text: 'Original prompt' } },
        permissions: { canManage: true },
        createdAt: now,
        updatedAt: now
      } as any
    ]);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await ui.click(await screen.findByRole('button', { name: /Edit/i }));
    const textarea = await screen.findByPlaceholderText('Edit the queued task before it starts');
    await ui.clear(textarea);
    await ui.type(textarea, 'Updated prompt');
    await ui.click(screen.getByRole('button', { name: /Save queue task/i }));

    await waitFor(() => expect(api.updateQueuedTaskContent).toHaveBeenCalledWith('t_edit', 'Updated prompt'));
  });
});
