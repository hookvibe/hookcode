import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

const renderPage = (props?: { taskGroupId?: string }) =>
  render(
    <AntdApp>
      <TaskGroupChatPage taskGroupId={props?.taskGroupId} />
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
        taskGroupId: undefined
      })
    );

    expect(window.location.hash).toBe('#/task-groups/g_new');
    expect(textarea).toHaveValue('');
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
});
