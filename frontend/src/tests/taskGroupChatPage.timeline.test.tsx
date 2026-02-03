// Split TaskGroupChatPage timeline tests into a dedicated spec file. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { act, screen, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../i18n';
import { TaskGroupChatPage } from '../pages/TaskGroupChatPage';
import { renderTaskGroupChatPage, setupTaskGroupChatMocks } from './taskGroupChatPageTestUtils';
import * as api from '../api';

describe('TaskGroupChatPage timeline', () => {
  beforeEach(() => {
    setupTaskGroupChatMocks();
  });

  // Validate optimistic in-place rendering on new group creation without a skeleton. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
  test('renders the sent question in the timeline after creating a new group', async () => {
    const ui = userEvent.setup();
    const now = '2026-01-11T00:00:00.000Z';

    // Reuse a single task payload so the chat bubble text is deterministic in tests. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
    const createdTask = {
      id: 't_new',
      eventType: 'chat',
      status: 'queued',
      payload: { __chat: { text: 'Hello from test' } },
      retries: 0,
      createdAt: now,
      updatedAt: now
    };

    vi.mocked(api.executeChat).mockResolvedValueOnce({
      taskGroup: {
        id: 'g_new',
        kind: 'chat',
        bindingKey: 'b1',
        title: 'Group new',
        repoId: 'r1',
        robotId: 'bot1',
        createdAt: now,
        updatedAt: now
      },
      task: createdTask as any
    });
    // Ensure refresh calls always return the newly sent task so the timeline stays populated. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([createdTask as any]);

    const view = renderTaskGroupChatPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText('Ask something… (Enter to send, Shift+Enter for newline)');
    await ui.type(textarea, 'Hello from test');

    const sendButton = screen.getByRole('button', { name: /Send/i });
    await ui.click(sendButton);

    await waitFor(() => expect(api.executeChat).toHaveBeenCalled());

    // Simulate the route change so the chat timeline is active for the new group. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
    view.rerender(
      <AntdApp>
        <TaskGroupChatPage taskGroupId="g_new" />
      </AntdApp>
    );

    expect(await screen.findByText('Hello from test')).toBeInTheDocument();
    expect(screen.queryByTestId('hc-chat-group-skeleton')).not.toBeInTheDocument();
    expect(document.querySelector('.hc-chat-item--enter')).toBeTruthy();
  });

  test('clears loading when navigating away (no stuck loading after switching)', async () => {
    const now = '2026-01-11T00:00:00.000Z';

    const task = {
      id: 't_done',
      eventType: 'chat',
      title: 'Task 1',
      status: 'succeeded',
      retries: 0,
      createdAt: now,
      updatedAt: now
    } as any;

    const group = {
      id: 'g1',
      kind: 'chat',
      bindingKey: 'b1',
      title: 'Group g1',
      repoId: 'r1',
      robotId: 'bot1',
      createdAt: now,
      updatedAt: now
    } as any;

    // Keep the initial group request pending to simulate a slow backend response.
    let resolveGroup!: (value: any) => void;
    let resolveTasks!: (value: any) => void;
    const groupPromise = new Promise((res) => {
      resolveGroup = res as any;
    });
    const tasksPromise = new Promise((res) => {
      resolveTasks = res as any;
    });

    vi.mocked(api.fetchTaskGroup).mockImplementationOnce(async () => (await groupPromise) as any);
    vi.mocked(api.fetchTaskGroupTasks).mockImplementationOnce(async () => (await tasksPromise) as any);

    const view = renderTaskGroupChatPage({ taskGroupId: 'g1' });

    // Assert on skeleton presence instead of a plain loading text placeholder. ro3ln7zex8d0wyynfj0m
    expect(await screen.findByTestId('hc-chat-group-skeleton')).toBeInTheDocument();

    // Simulate route switch to Home (no group selected).
    view.rerender(
      <AntdApp>
        <TaskGroupChatPage />
      </AntdApp>
    );

    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();
    expect(screen.queryByTestId('hc-chat-group-skeleton')).not.toBeInTheDocument();

    // Even if the previous request resolves late, it must not overwrite the current Home view.
    resolveGroup(group);
    resolveTasks([task]);

    await waitFor(() => {
      expect(screen.getByText('What can I do for you?')).toBeInTheDocument();
      expect(screen.queryByText('Group g1')).not.toBeInTheDocument();
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
    });
  });

  // Keep loaded chat content visible when a locale change triggers a blocking refresh. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126
  test('keeps loaded timeline visible during locale-triggered refresh', async () => {
    const now = '2026-01-11T00:00:00.000Z';

    const task = {
      id: 't_keep',
      eventType: 'chat',
      payload: { __chat: { text: 'Keep this message' } },
      status: 'queued',
      retries: 0,
      createdAt: now,
      updatedAt: now
    } as any;

    const group = {
      id: 'g1',
      kind: 'chat',
      bindingKey: 'b1',
      title: 'Group g1',
      repoId: 'r1',
      robotId: 'bot1',
      createdAt: now,
      updatedAt: now
    } as any;

    setLocale('zh-CN');
    vi.mocked(api.fetchTaskGroup).mockResolvedValueOnce(group);
    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce([task]);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    expect(await screen.findByText('Keep this message')).toBeInTheDocument();
    expect(screen.queryByTestId('hc-chat-group-skeleton')).not.toBeInTheDocument();

    let resolveGroup!: (value: any) => void;
    let resolveTasks!: (value: any) => void;
    const groupPromise = new Promise((res) => {
      resolveGroup = res as any;
    });
    const tasksPromise = new Promise((res) => {
      resolveTasks = res as any;
    });

    vi.mocked(api.fetchTaskGroup).mockImplementationOnce(async () => (await groupPromise) as any);
    vi.mocked(api.fetchTaskGroupTasks).mockImplementationOnce(async () => (await tasksPromise) as any);

    act(() => {
      setLocale('en-US');
    });

    await waitFor(() => expect(api.fetchTaskGroup).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Keep this message')).toBeInTheDocument();
    expect(screen.queryByTestId('hc-chat-group-skeleton')).not.toBeInTheDocument();

    resolveGroup(group);
    resolveTasks([task]);

    await waitFor(() => expect(api.fetchTaskGroupTasks).toHaveBeenCalledTimes(2));
  });

  // Preserve timeline content during refresh failures to avoid UX resets. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126
  test('keeps timeline content when refresh polling hits a network failure', async () => {
    const now = '2026-01-11T00:00:00.000Z';
    const tasks = [
      {
        id: 't_keep',
        eventType: 'chat',
        payload: { __chat: { text: 'Keep this message' } },
        status: 'queued',
        retries: 0,
        createdAt: now,
        updatedAt: now
      }
    ];

    const group = {
      id: 'g1',
      kind: 'chat',
      bindingKey: 'b1',
      title: 'Group g1',
      repoId: 'r1',
      robotId: 'bot1',
      createdAt: now,
      updatedAt: now
    } as any;

    const networkError = Object.assign(new Error('Network Error'), { response: undefined });
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;

    let tick!: () => void;
    const intervalPromise = new Promise<void>((res) => {
      tick = res;
    });

    window.setInterval = ((cb: () => void) => {
      intervalPromise.then(cb);
      return 101;
    }) as any;
    window.clearInterval = vi.fn();

    vi.mocked(api.fetchTaskGroup).mockResolvedValueOnce(group);
    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce(tasks as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    expect(await screen.findByText('Keep this message')).toBeInTheDocument();

    vi.mocked(api.fetchTaskGroupTasks).mockRejectedValueOnce(networkError);
    tick();

    await waitFor(() => expect(api.fetchTaskGroupTasks).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Keep this message')).toBeInTheDocument();

    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
  });

  test('renders only the latest 3 tasks by default and loads older tasks when scrolling up', async () => {
    const now = '2026-01-11T00:00:00.000Z';
    const tasks = Array.from({ length: 5 }).map((_, idx) => ({
      id: `t_${idx}`,
      eventType: 'chat',
      payload: { __chat: { text: `Message ${idx}` } },
      status: 'queued',
      retries: 0,
      createdAt: now,
      updatedAt: now
    }));

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce(tasks as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    expect(await screen.findByText('Message 4')).toBeInTheDocument();
    expect(screen.queryByText('Message 0')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Message/)).toHaveLength(3);

    const loadMore = screen.getByRole('button', { name: 'Load older messages' });
    await userEvent.click(loadMore);

    expect(await screen.findByText('Message 0')).toBeInTheDocument();
    expect(screen.getAllByText(/Message/)).toHaveLength(5);
  });

  test('keeps chat pinned to bottom when async log rendering expands height', async () => {
    const now = '2026-01-11T00:00:00.000Z';
    const tasks = Array.from({ length: 3 }).map((_, idx) => ({
      id: `t_${idx}`,
      eventType: 'chat',
      payload: { __chat: { text: `Message ${idx}` } },
      status: 'queued',
      retries: 0,
      createdAt: now,
      updatedAt: now
    }));

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce(tasks as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await screen.findByText('Message 2');

    const scroller = document.querySelector('.hc-chat-scroll') as HTMLElement;
    const scrollSpy = vi.spyOn(scroller, 'scrollTo');
    scroller.scrollTop = 100;
    scroller.scrollHeight = 200;
    scroller.clientHeight = 100;

    window.dispatchEvent(new Event('resize'));

    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
  });
});
