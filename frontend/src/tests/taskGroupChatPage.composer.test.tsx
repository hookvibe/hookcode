// Split TaskGroupChatPage composer tests into a focused spec file. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTaskGroupChatPage, setupTaskGroupChatMocks } from './taskGroupChatPageTestUtils';
import * as api from '../api';

// Reuse the live composer placeholder text so TaskGroup chat tests follow the current compact composer copy on every platform. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
const chatComposerPlaceholder = 'Ask something… (Enter to send, Shift+Enter for newline)';

const openComposerActions = async (ui: ReturnType<typeof userEvent.setup>) => {
  // Open the compact composer settings popover before asserting repo/robot/worker controls that are no longer always visible. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
  await ui.click(await screen.findByRole('button', { name: 'Composer actions' }));
};

describe('TaskGroupChatPage composer', () => {
  beforeEach(() => {
    setupTaskGroupChatMocks();
  });

  test('submits a new chat task group and updates hash route', async () => {
    const ui = userEvent.setup();
    renderTaskGroupChatPage();

    // Expect chat page repo fetch to use the shared repo loader before submitting. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    await waitFor(() => expect(api.fetchAllRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.listAvailableRepoRobots).toHaveBeenCalled());

    const textarea = await screen.findByPlaceholderText(chatComposerPlaceholder);
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

    await waitFor(() => expect(api.listAvailableRepoRobots).toHaveBeenCalled());
    // Assert the mixed-scope robot label so chat selector coverage matches the current formatter. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    expect(await screen.findByText('Robot 1 / codex / Repo')).toBeInTheDocument();
  });

  test('submits a chat task with an explicit worker override for admins', async () => {
    // Verify admin chat users can route manual tasks to a selected worker. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-user', JSON.stringify({ id: 'u_admin', username: 'admin', roles: ['admin'] }));
    renderTaskGroupChatPage();

    await waitFor(() => expect(api.fetchWorkers).toHaveBeenCalled());
    const workerPill = await screen.findByText('Auto worker');
    const workerRoot = workerPill.closest('.hc-pill');
    expect(workerRoot).toBeTruthy();
    await ui.click(workerRoot as HTMLElement);
    await ui.click(await screen.findByText(/Worker 1/i));

    const textarea = await screen.findByPlaceholderText(chatComposerPlaceholder);
    await ui.type(textarea, 'Route this to worker 1');
    await ui.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() =>
      expect(api.executeChat).toHaveBeenCalledWith({
        repoId: 'r1',
        robotId: 'bot1',
        text: 'Route this to worker 1',
        taskGroupId: undefined,
        timeWindow: null,
        workerId: 'w1'
      })
    );
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

    // Assert the disabled compact footer controls because unsupported groups no longer render always-visible repo/robot selects. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const actionsButton = await screen.findByRole('button', { name: 'Composer actions' });
    const textarea = await screen.findByPlaceholderText(chatComposerPlaceholder);

    expect(actionsButton).toBeDisabled();
    expect(textarea).toBeDisabled();
    expect(screen.getByText('This task group does not support manual chat messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/i })).toBeDisabled();
  });
});
