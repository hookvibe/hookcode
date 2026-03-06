// Split TaskGroupChatPage composer tests into a focused spec file. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

    // Expect chat page repo fetch to use the shared repo loader before submitting. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    await waitFor(() => expect(api.fetchAllRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText('Ask something… (Enter to send, Shift+Enter for newline)');
    await ui.type(textarea, 'Hello from test');
    await ui.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() =>
      expect(api.executeChat).toHaveBeenCalledWith({
        repoId: 'r1',
        robotId: 'bot1',
        text: 'Hello from test',
        taskGroupId: undefined,
        timeWindow: null
      })
    );

    expect(window.location.hash).toBe('#/task-groups/g_new');
    expect(textarea).toHaveValue('');
  });

  test('shows bound AI provider in the robot selector', async () => {
    renderTaskGroupChatPage();

    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());

    const robotSelect = await screen.findByLabelText('Robot');
    await waitFor(() => {
      const selectRoot = robotSelect.closest('.ant-select');
      expect(selectRoot).toHaveTextContent('Robot 1 / codex');
    });
  });

  test('renders composer actions popover with time window and preview start', async () => {
    const ui = userEvent.setup();
    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchAllRepos).toHaveBeenCalled());
    const actionsButton = screen.getByRole('button', { name: 'Composer actions' });
    await ui.click(actionsButton);

    expect(screen.getByText('Execution window')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start preview' })).toBeInTheDocument();
  });

  test('loads task-group skill mode before opening the skill modal', async () => {
    const ui = userEvent.setup();
    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    // Load task-group skill state eagerly so the composer actions panel shows the resolved mode without a manual refresh. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    await waitFor(() => expect(api.fetchTaskGroupSkillSelection).toHaveBeenCalledWith('g1'));
    const actionsButton = await screen.findByRole('button', { name: 'Composer actions' });
    await ui.click(actionsButton);

    expect(await screen.findByText('Use repo defaults')).toBeInTheDocument();
  });

  test('opens the skill selection modal from composer actions', async () => {
    const ui = userEvent.setup();
    renderTaskGroupChatPage({ taskGroupId: 'g1' });

    await waitFor(() => expect(api.fetchTaskGroup).toHaveBeenCalled());
    const actionsButton = await screen.findByRole('button', { name: 'Composer actions' });
    await ui.click(actionsButton);
    await ui.click(await screen.findByRole('button', { name: /Configure skills/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Task group skills', { selector: '.ant-modal-title' })).toBeInTheDocument();
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

    expect(repoSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(robotSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(textarea).toBeDisabled();
    expect(screen.getByText('This task group does not support manual chat messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/i })).toBeDisabled();
  });
});
