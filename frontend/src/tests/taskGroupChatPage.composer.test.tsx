// Split TaskGroupChatPage composer tests into a focused spec file. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTaskGroupChatPage, setupTaskGroupChatMocks } from './taskGroupChatPageTestUtils';
import * as api from '../api';

describe('TaskGroupChatPage composer', () => {
  beforeEach(() => {
    setupTaskGroupChatMocks();
  });

  test('submits a new chat task group and updates hash route', async () => {
    const ui = userEvent.setup();
    renderTaskGroupChatPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText('Ask something… (Enter to send, Shift+Enter for newline)');
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

  // Validate provider labels appear in robot picker text. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
  test('shows bound AI provider in the robot selector', async () => {
    renderTaskGroupChatPage();

    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const robotSelect = await screen.findByLabelText('Robot');
    await waitFor(() => {
      const selectRoot = robotSelect.closest('.ant-select');
      expect(selectRoot).toHaveTextContent('Robot 1 / codex');
    });
  });

  test('appends next-action suggestions into the chat composer', async () => {
    // Verify suggestion buttons feed the chat composer draft for follow-up prompts. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const ui = userEvent.setup();
    const now = '2026-01-11T00:00:00.000Z';
    const outputText = JSON.stringify({
      output: 'Result text',
      next_actions: ['Action 1', 'Action 2', 'Action 3']
    });

    vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([
      {
        id: 't_done',
        eventType: 'chat',
        status: 'succeeded',
        retries: 0,
        createdAt: now,
        updatedAt: now
      } as any
    ]);
    vi.mocked(api.fetchTask).mockResolvedValue({
      id: 't_done',
      eventType: 'chat',
      status: 'succeeded',
      retries: 0,
      createdAt: now,
      updatedAt: now,
      result: { outputText }
    } as any);

    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    const suggestion = await screen.findByRole('button', { name: 'Action 1' });
    const textarea = await screen.findByPlaceholderText('Ask something… (Enter to send, Shift+Enter for newline)');

    await ui.click(suggestion);
    expect(textarea).toHaveValue('Action 1');
  });

  // Ensure the time-window control renders as a compact icon button. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  test('renders time window icon button in the composer', async () => {
    renderTaskGroupChatPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Execution window' })).toBeInTheDocument();
  });

  test('does not submit when robot is missing (Enter-to-send)', async () => {
    const ui = userEvent.setup();

    vi.mocked(api.listRepoRobots).mockResolvedValue([]);
    renderTaskGroupChatPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText('Ask something… (Enter to send, Shift+Enter for newline)');
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

    renderTaskGroupChatPage({ taskGroupId: 'g_task' });

    const repoSelect = await screen.findByLabelText('Repository');
    const robotSelect = await screen.findByLabelText('Robot');
    const textarea = await screen.findByPlaceholderText('Ask something… (Enter to send, Shift+Enter for newline)');

    // AntD Select uses nested inputs; assert on the closest Select wrapper for the disabled state.
    expect(repoSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(robotSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(textarea).toBeDisabled();
    expect(screen.getByText('This task group does not support manual chat messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/i })).toBeDisabled();
  });
});
