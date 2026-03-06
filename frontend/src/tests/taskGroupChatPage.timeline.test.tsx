// Split TaskGroupChatPage timeline tests into a dedicated spec file. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { act, screen, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../i18n';
import { buildTaskGroupChatPageElement, renderTaskGroupChatPage, setupTaskGroupChatMocks } from './taskGroupChatPageTestUtils'; // Use the shared element factory so rerenders keep mocked api wiring. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
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

    // Expect chat page repo fetch to use paginated helper. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    await waitFor(() => expect(api.fetchAllRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText('Ask something… (Enter to send, Shift+Enter for newline)');
    await ui.type(textarea, 'Hello from test');

    const sendButton = screen.getByRole('button', { name: /Send/i });
    await ui.click(sendButton);

    await waitFor(() => expect(api.executeChat).toHaveBeenCalled());

    // Simulate the route change so the chat timeline is active for the new group. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
    view.rerender(buildTaskGroupChatPageElement({ taskGroupId: 'g_new' }));

    expect(await screen.findByText('Hello from test')).toBeInTheDocument();
    expect(screen.queryByTestId('hc-chat-group-skeleton')).not.toBeInTheDocument();
    expect(document.querySelector('.hc-chat-item--enter')).toBeTruthy();
  });

  // Validate empty-state messaging for task groups that have no tasks. docs/en/developer/plans/taskgroup-empty-display-20260203/task_plan.md taskgroup-empty-display-20260203
  test('shows an empty-state message for existing task groups with no tasks', async () => {
    renderTaskGroupChatPage({ taskGroupId: 'g_empty' });

    expect(await screen.findByText('No tasks in this group')).toBeInTheDocument();
    // Validate the expanded empty-group hint text for dialog-only fixes. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    expect(screen.getByText('Start a new task below or return to the task group list.')).toBeInTheDocument();
    expect(screen.queryByText('What can I do for you?')).not.toBeInTheDocument();
  });

  // Refresh chat timeline when SSE pushes a task-group update. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302
  test('refreshes task group on SSE update events', async () => {
    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchTaskGroup).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.fetchTaskGroupTasks).toHaveBeenCalledTimes(1));

    const sources = ((globalThis as any).__eventSourceInstances ?? []) as Array<{
      url?: string;
      emit: (type: string, ev?: any) => void;
    }>;
    const stream = sources.find((source) => source.url?.includes('/events/stream'));
    expect(stream).toBeTruthy();

    act(() => {
      stream!.emit('task-group.refresh', { data: JSON.stringify({ groupId: 'g1' }) });
    });

    await waitFor(() => expect(api.fetchTaskGroup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.fetchTaskGroupTasks).toHaveBeenCalledTimes(2));
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
    view.rerender(buildTaskGroupChatPageElement());

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

  test('loads task logs in a chained order before revealing previous tasks', async () => {
    const baseTime = new Date('2026-01-11T00:00:00.000Z').getTime();
    const tasks = Array.from({ length: 3 }).map((_, idx) => ({
      id: `t_${idx}`,
      eventType: 'chat',
      payload: { __chat: { text: `Message ${idx}` } },
      status: 'queued',
      retries: 0,
      createdAt: new Date(baseTime + idx * 1000).toISOString(),
      updatedAt: new Date(baseTime + idx * 1000).toISOString()
    }));

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce(tasks as any);
    // Mock paged responses to verify task logs finish loading before the previous task is shown. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    vi.mocked(api.fetchTaskLogsPage)
      .mockResolvedValueOnce({ logs: ['older log t2'], startSeq: 1, endSeq: 1, nextBefore: null } as any)
      .mockResolvedValueOnce({ logs: ['older log t1'], startSeq: 1, endSeq: 1, nextBefore: null } as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    expect(await screen.findByText('Message 2')).toBeInTheDocument();
    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Message 0')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Message/)).toHaveLength(1);

    const taskSources = (((globalThis as any).__eventSourceInstances ?? []) as Array<{
      url?: string;
      emit: (type: string, ev?: any) => void;
    }>).filter((source) => source.url?.includes('/tasks/'));
    const task2Source = taskSources.find((source) => source.url?.includes('/tasks/t_2/logs/stream'));
    expect(task2Source).toBeTruthy();
    act(() => {
      task2Source!.emit('init', {
        data: JSON.stringify({ logs: ['latest t2'], startSeq: 2, endSeq: 2, nextBefore: 2 })
      });
    });

    const chatBody = document.querySelector('.hc-chat-body') as HTMLElement;
    expect(chatBody).toBeTruthy();
    // Trigger top-scroll chain loading: same task history first, previous task only after exhaustion. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    chatBody.scrollTop = 0;
    chatBody.dispatchEvent(new Event('scroll'));

    await waitFor(() =>
      expect(api.fetchTaskLogsPage).toHaveBeenNthCalledWith(1, 't_2', expect.objectContaining({ before: 2 }))
    );
    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();

    chatBody.scrollTop = 0;
    chatBody.dispatchEvent(new Event('scroll'));

    expect(await screen.findByText('Message 1')).toBeInTheDocument();
    expect(screen.queryByText('Message 0')).not.toBeInTheDocument();

    const task1Source = ((((globalThis as any).__eventSourceInstances ?? []) as Array<{
      url?: string;
      emit: (type: string, ev?: any) => void;
    }>)).find((source) => source.url?.includes('/tasks/t_1/logs/stream'));
    expect(task1Source).toBeTruthy();
    act(() => {
      task1Source!.emit('init', {
        data: JSON.stringify({ logs: ['latest t1'], startSeq: 2, endSeq: 2, nextBefore: 2 })
      });
    });

    chatBody.scrollTop = 0;
    chatBody.dispatchEvent(new Event('scroll'));

    await waitFor(() =>
      expect(api.fetchTaskLogsPage).toHaveBeenNthCalledWith(2, 't_1', expect.objectContaining({ before: 2 }))
    );
    expect(screen.queryByText('Message 0')).not.toBeInTheDocument();

    await waitFor(() => {
      // Retry top-scroll until the task-level exhaustion callback unlocks the previous task in the chain. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      chatBody.scrollTop = 0;
      chatBody.dispatchEvent(new Event('scroll'));
      expect(screen.getByText('Message 0')).toBeInTheDocument();
    });
  });

  test('continues chained loading when the active task log stream fails before init', async () => {
    const baseTime = new Date('2026-01-11T00:00:00.000Z').getTime();
    const tasks = Array.from({ length: 2 }).map((_, idx) => ({
      id: `t_err_${idx}`,
      eventType: 'chat',
      payload: { __chat: { text: `Error Message ${idx}` } },
      status: idx === 1 ? 'failed' : 'queued',
      retries: 0,
      createdAt: new Date(baseTime + idx * 1000).toISOString(),
      updatedAt: new Date(baseTime + idx * 1000).toISOString()
    }));

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce(tasks as any);
    // Return an empty page in fallback bootstrap so the active task is treated as exhausted after stream failure. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    vi.mocked(api.fetchTaskLogsPage).mockResolvedValueOnce({
      logs: [],
      startSeq: 0,
      endSeq: 0,
      nextBefore: null
    } as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    expect(await screen.findByText('Error Message 1')).toBeInTheDocument();
    expect(screen.queryByText('Error Message 0')).not.toBeInTheDocument();

    const activeSource = await waitFor(() => {
      const source = (((globalThis as any).__eventSourceInstances ?? []) as Array<{
        url?: string;
        emit: (type: string, ev?: any) => void;
      }>).find((instance) => instance.url?.includes('/tasks/t_err_1/logs/stream'));
      expect(source).toBeTruthy();
      return source!;
    });

    act(() => {
      activeSource.emit('error', {});
    });

    await waitFor(() =>
      expect(api.fetchTaskLogsPage).toHaveBeenCalledWith('t_err_1', expect.objectContaining({ limit: 400 }))
    );

    const chatBody = document.querySelector('.hc-chat-body') as HTMLElement;
    expect(chatBody).toBeTruthy();
    await waitFor(() => {
      // Retry top-scroll while waiting for fallback bootstrap callbacks to unlock the previous task. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      chatBody.scrollTop = 0;
      chatBody.dispatchEvent(new Event('scroll'));
      expect(screen.getByText('Error Message 0')).toBeInTheDocument();
    });
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

    const chatBody = document.querySelector('.hc-chat-body') as HTMLElement;
    expect(chatBody).toBeTruthy();

    let scrollHeight = 200;
    Object.defineProperty(chatBody, 'scrollHeight', {
      get: () => scrollHeight,
      configurable: true
    });
    Object.defineProperty(chatBody, 'clientHeight', {
      get: () => 100,
      configurable: true
    });
    chatBody.scrollTop = 100;

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    // Simulate async log growth via DOM mutations so the observer-driven pin logic runs. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
    scrollHeight = 260;
    chatBody.appendChild(document.createElement('div'));

    await waitFor(() => expect(chatBody.scrollTop).toBe(260));
    rafSpy.mockRestore();
  });
});
