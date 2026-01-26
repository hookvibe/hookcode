import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { TaskGroupChatPage } from '../pages/TaskGroupChatPage';
import * as api from '../api';

vi.mock('../api', () => {
  const now = '2026-01-11T00:00:00.000Z';

  const repo = {
    id: 'r1',
    provider: 'gitlab',
    name: 'Repo 1',
    enabled: true,
    createdAt: now,
    updatedAt: now
  };

  const robot = {
    id: 'bot1',
    repoId: 'r1',
    name: 'Robot 1',
    permission: 'read',
    enabled: true,
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };

  const makeTask = (id: string) => ({
    id,
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: now,
    updatedAt: now
  });

  return {
    __esModule: true,
    executeChat: vi.fn(async () => ({
      taskGroup: {
        id: 'g_new',
        kind: 'chat',
        bindingKey: 'b1',
        title: 'Group new',
        repoId: repo.id,
        robotId: robot.id,
        createdAt: now,
        updatedAt: now
      },
      task: makeTask('t_new')
    })),
    fetchTask: vi.fn(async (id: string) => makeTask(id)),
    fetchTaskGroup: vi.fn(async (id: string) => ({
      id,
      kind: 'chat',
      bindingKey: 'b1',
      title: `Group ${id}`,
      repoId: repo.id,
      robotId: robot.id,
      createdAt: now,
      updatedAt: now
    })),
    fetchTaskGroupTasks: vi.fn(async () => []),
    listRepos: vi.fn(async () => [repo]),
    listRepoRobots: vi.fn(async () => [robot])
  };
});

const renderPage = (props?: { taskGroupId?: string; taskLogsEnabled?: boolean | null }) =>
  render(
    <AntdApp>
      <TaskGroupChatPage taskGroupId={props?.taskGroupId} taskLogsEnabled={props?.taskLogsEnabled} />
    </AntdApp>
  );

describe('TaskGroupChatPage (frontend-chat migration)', () => {
  beforeEach(() => {
    const now = '2026-01-11T00:00:00.000Z';
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/';

    // Ensure each test starts from a known mock baseline (avoid cross-test mock leakage).
    vi.mocked(api.listRepos).mockResolvedValue([
      { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true, createdAt: now, updatedAt: now } as any
    ]);
    vi.mocked(api.listRepoRobots).mockResolvedValue([
      {
        id: 'bot1',
        repoId: 'r1',
        name: 'Robot 1',
        permission: 'read',
        enabled: true,
        isDefault: true,
        createdAt: now,
        updatedAt: now
      } as any
    ]);
    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([]);
    vi.mocked(api.fetchTaskGroup).mockImplementation(async (id: string) => ({
      id,
      kind: 'chat',
      bindingKey: 'b1',
      title: `Group ${id}`,
      repoId: 'r1',
      robotId: 'bot1',
      createdAt: now,
      updatedAt: now
    }));
    vi.mocked(api.fetchTask).mockImplementation(async (id: string) => ({
      id,
      eventType: 'chat',
      status: 'queued',
      retries: 0,
      createdAt: now,
      updatedAt: now
    }));
    vi.mocked(api.executeChat).mockImplementation(async () => ({
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
      task: {
        id: 't_new',
        eventType: 'chat',
        status: 'queued',
        retries: 0,
        createdAt: now,
        updatedAt: now
      }
    }));
  });

  test('submits a new chat task group and updates hash route', async () => {
    const ui = userEvent.setup();
    renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText(
      'Ask something… (Enter to send, Shift+Enter for newline)'
    );
    await ui.type(textarea, 'Hello from test');

    const sendButton = screen.getByRole('button', { name: /Send/i });
    await ui.click(sendButton);

    await waitFor(() =>
      expect(api.executeChat).toHaveBeenCalledWith({
        repoId: 'r1',
        robotId: 'bot1',
        text: 'Hello from test',
        taskGroupId: undefined,
        // Include timeWindow to match the chat payload shape. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
        timeWindow: null
      })
    );

    expect(window.location.hash).toBe('#/task-groups/g_new');
    expect(textarea).toHaveValue('');
  });

  // Ensure the time-window control renders as a compact icon button. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  test('renders time window icon button in the composer', async () => {
    renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Execution window' })).toBeInTheDocument();
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

    const view = renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText(
      'Ask something… (Enter to send, Shift+Enter for newline)'
    );
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

  test('does not submit when robot is missing (Enter-to-send)', async () => {
    const ui = userEvent.setup();

    vi.mocked(api.listRepoRobots).mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText(
      'Ask something… (Enter to send, Shift+Enter for newline)'
    );
    await ui.type(textarea, 'Hello{enter}');

    expect(api.executeChat).not.toHaveBeenCalled();
  });

  test('disables sender controls for unsupported task group kinds', async () => {
    vi.mocked(api.fetchTaskGroup).mockResolvedValueOnce({
      id: 'g_task',
      kind: 'task',
      bindingKey: 'b1',
      title: 'Group task',
      repoId: 'r1',
      robotId: 'bot1',
      createdAt: '',
      updatedAt: '2026-01-11T00:00:00.000Z'
    } as any);

    renderPage({ taskGroupId: 'g_task' });

    const repoSelect = await screen.findByLabelText('Repository');
    const robotSelect = await screen.findByLabelText('Robot');
    const textarea = await screen.findByPlaceholderText(
      'Ask something… (Enter to send, Shift+Enter for newline)'
    );

    // AntD Select uses nested inputs; assert on the closest Select wrapper for the disabled state.
    expect(repoSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(robotSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(textarea).toBeDisabled();
    expect(screen.getByText('This task group does not support manual chat messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/i })).toBeDisabled();
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

    const view = renderPage({ taskGroupId: 'g1' });

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

    renderPage({ taskGroupId: 'g1' });

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
    const intervalSpy = vi.spyOn(window, 'setInterval');
    const clearSpy = vi.spyOn(window, 'clearInterval');
    let intervalCallback: (() => void) | null = null;

    intervalSpy.mockImplementation(((callback: TimerHandler, timeout?: number, ...args: any[]) => {
      if (timeout === 5000) {
        intervalCallback = callback as () => void;
        return 1 as any;
      }
      return originalSetInterval(callback, timeout as number, ...args);
    }) as typeof window.setInterval);
    clearSpy.mockImplementation((id?: number) => originalClearInterval(id as number));

    vi.mocked(api.fetchTaskGroup).mockResolvedValueOnce(group);
    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce(tasks as any);
    vi.mocked(api.fetchTaskGroup).mockRejectedValueOnce(networkError as any);
    vi.mocked(api.fetchTaskGroupTasks).mockRejectedValueOnce(networkError as any);

    try {
      renderPage({ taskGroupId: 'g1' });

      expect(await screen.findByText('Keep this message')).toBeInTheDocument();

      await waitFor(() => expect(api.fetchTaskGroup).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(intervalCallback).not.toBeNull());
      intervalCallback?.();

      await waitFor(() => expect(api.fetchTaskGroup).toHaveBeenCalledTimes(2));
      expect(screen.getByText('Keep this message')).toBeInTheDocument();
      expect(screen.queryByTestId('hc-chat-group-skeleton')).not.toBeInTheDocument();
    } finally {
      intervalSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });

  test('renders only the latest 3 tasks by default and loads older tasks when scrolling up', async () => {
    // Reverse paging keeps TaskGroup chat short while always rendering ThoughtChain inline. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
    const tasks = Array.from({ length: 7 }, (_, idx) => {
      const n = idx + 1;
      return {
        id: `t_${n}`,
        eventType: 'chat',
        title: `Task ${n}`,
        payload: { __chat: { text: `Message ${n}` } },
        status: 'queued',
        retries: 0,
        createdAt: `2026-01-11T00:00:0${n}.000Z`,
        updatedAt: `2026-01-11T00:00:0${n}.000Z`
      } as any;
    });

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValueOnce(tasks);
    renderPage({ taskGroupId: 'g1', taskLogsEnabled: false });

    await waitFor(() => expect(api.fetchTaskGroupTasks).toHaveBeenCalled());

    // Only the latest 3 tasks should be rendered initially.
    expect(await screen.findByText('Task 5')).toBeInTheDocument();
    expect(screen.getByText('Task 6')).toBeInTheDocument();
    expect(screen.getByText('Task 7')).toBeInTheDocument();
    expect(screen.queryByText('Task 4')).not.toBeInTheDocument();

    const chatBody = document.querySelector('.hc-chat-body') as HTMLElement;
    expect(chatBody).toBeTruthy();

    chatBody.scrollTop = 0;
    chatBody.dispatchEvent(new Event('scroll'));

    expect(await screen.findByText('Task 4')).toBeInTheDocument();
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument();

    chatBody.scrollTop = 0;
    chatBody.dispatchEvent(new Event('scroll'));

    expect(await screen.findByText('Task 1')).toBeInTheDocument();
  });

  test('keeps chat pinned to bottom when async log rendering expands height', async () => {
    // Mock ResizeObserver so we can simulate async height changes in tests. docs/en/developer/plans/taskgroupscrollbottom20260123/task_plan.md taskgroupscrollbottom20260123
    const originalResizeObserver = window.ResizeObserver;
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    let observerInstance: { el?: Element | null; cb?: ResizeObserverCallback } | null = null;

    class MockResizeObserver {
      cb: ResizeObserverCallback;
      el: Element | null = null;

      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        observerInstance = this;
      }

      observe(el: Element) {
        this.el = el;
      }

      disconnect() {
        this.el = null;
      }
    }

    (window as any).ResizeObserver = MockResizeObserver;

    renderPage({ taskGroupId: 'g1', taskLogsEnabled: false });

    await waitFor(() => expect(api.fetchTaskGroupTasks).toHaveBeenCalled());

    const chatBody = document.querySelector('.hc-chat-body') as HTMLElement;
    expect(chatBody).toBeTruthy();

    Object.defineProperty(chatBody, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(chatBody, 'scrollHeight', { value: 400, configurable: true });
    chatBody.scrollTop = 0;

    Object.defineProperty(chatBody, 'scrollHeight', { value: 900, configurable: true });
    observerInstance?.cb?.([{ target: chatBody } as ResizeObserverEntry], observerInstance as any);

    expect(chatBody.scrollTop).toBe(900);

    (window as any).ResizeObserver = originalResizeObserver;
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});
