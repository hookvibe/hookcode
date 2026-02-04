import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { TaskDetailPage } from '../pages/TaskDetailPage';
import * as api from '../api';

vi.mock('../api', () => {
  return {
    __esModule: true,
    fetchTask: vi.fn(async () => ({
      id: 't1',
      eventType: 'chat',
      title: 'Task t1',
      status: 'failed',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true },
      // Task detail meta cards rely on repo/robot/user fields, so include them in the mocked response.
      repoId: 'r1',
      repoProvider: 'gitlab',
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo r1', enabled: true },
      robotId: 'bot1',
      robot: { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true },
      payload: { user_name: 'Alice', user_username: 'alice', user_avatar: 'https://example.com/avatar.png' },
      dependencyResult: {
        status: 'failed',
        totalDuration: 12000,
        steps: [
          { language: 'node', command: 'pnpm install --frozen-lockfile', status: 'success', duration: 5000 },
          {
            language: 'python',
            command: 'pip install -r requirements.txt',
            status: 'failed',
            duration: 7000,
            workdir: 'backend',
            error: 'exit code 1'
          }
        ]
      },
      // Include git status so the Result panel renders the moved status card. docs/en/developer/plans/nsdxp7gt9e14t1upz90z/task_plan.md nsdxp7gt9e14t1upz90z
      result: {
        gitStatus: {
          enabled: true,
          workingTree: { staged: [], unstaged: [], untracked: [] },
          push: { status: 'not_applicable' }
        }
      }
    })),
    retryTask: vi.fn(async () => ({
      id: 't1',
      eventType: 'chat',
      title: 'Task t1',
      status: 'queued',
      retries: 1,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true }
    })),
    executeTaskNow: vi.fn(async () => ({
      id: 't1',
      eventType: 'chat',
      title: 'Task t1',
      status: 'queued',
      retries: 1,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true }
    })),
    // Mock pause/resume APIs for task control actions. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    pauseTask: vi.fn(async () => ({
      id: 't1',
      eventType: 'chat',
      title: 'Task t1',
      status: 'paused',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true }
    })),
    resumeTask: vi.fn(async () => ({
      id: 't1',
      eventType: 'chat',
      title: 'Task t1',
      status: 'queued',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true }
    })),
    deleteTask: vi.fn(async () => undefined),
    // Provide robot provider lookup for task detail provider labels. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
    listRepoRobots: vi.fn(async () => [
      { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true, modelProvider: 'codex' }
    ])
  };
});

const renderPage = (props: { taskId: string }) =>
  render(
    <AntdApp>
      <TaskDetailPage taskId={props.taskId} />
    </AntdApp>
  );

describe('TaskDetailPage (frontend-chat migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/tasks/t1';
  });

  test('retries and deletes a task when canManage=true', async () => {
    const ui = userEvent.setup();
    renderPage({ taskId: 't1' });

    await waitFor(() => expect(api.fetchTask).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoRobots).toHaveBeenCalled());
    expect(await screen.findByText('Task t1', { selector: '.hc-page__title' })).toBeInTheDocument();

    // Regression: ensure the full-width task summary strip still surfaces key fields for quick scanning. tdlayout20260117k8p3
    const strip = document.querySelector('.hc-task-summary-strip');
    expect(strip).toBeTruthy();
    const stripScope = within(strip as HTMLElement);
    expect(stripScope.getByText('Repository')).toBeInTheDocument();
    expect(stripScope.getByText('Robot')).toBeInTheDocument();
    expect(stripScope.getByText('Author')).toBeInTheDocument();
    expect(stripScope.getByText('Repo r1')).toBeInTheDocument();
    expect(stripScope.getByText('Robot bot1')).toBeInTheDocument();
    // Ensure bound AI provider is visible in the task summary strip. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
    expect(stripScope.getByText('codex')).toBeInTheDocument();
    expect(stripScope.getByText('Alice')).toBeInTheDocument();
    expect(stripScope.getByText(/@alice/i)).toBeInTheDocument();

    // Regression: ensure the task detail panel switcher uses the reordered step tabs. docs/en/developer/plans/nsdxp7gt9e14t1upz90z/task_plan.md nsdxp7gt9e14t1upz90z
    const switcher = document.querySelector('.hc-task-detail-panel-switcher');
    expect(switcher).toBeTruthy();
    const stepTitles = Array.from((switcher as HTMLElement).querySelectorAll('.hc-task-detail-step-label')).map((el) =>
      String(el.textContent || '').trim()
    );
    expect(stepTitles).toEqual(['Raw webhook payload', 'Prompt patch (repo config)', 'Live logs', 'Result']);

    // Default to Result panel for terminal tasks and allow switching to other panels. docs/en/developer/plans/nsdxp7gt9e14t1upz90z/task_plan.md nsdxp7gt9e14t1upz90z
    expect(await screen.findByText('No output')).toBeInTheDocument();
    expect(screen.getByText('Git status')).toBeInTheDocument();
    await ui.click(screen.getByText('Raw webhook payload'));
    expect(await screen.findByText(/user_name/i)).toBeInTheDocument();
    // Ensure the structured JSON viewer wraps the payload panel. docs/en/developer/plans/payloadjsonui20260128/task_plan.md payloadjsonui20260128
    expect(document.querySelector('.hc-json-viewer')).toBeTruthy();

    // Allow collapsing the task detail sidebar to focus on workflow panels. docs/en/developer/plans/nsdxp7gt9e14t1upz90z/task_plan.md nsdxp7gt9e14t1upz90z
    const sidebar = document.querySelector('.hc-task-detail-sidebar') as HTMLElement;
    expect(sidebar).toBeTruthy();
    await ui.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(sidebar).toHaveClass('hc-task-detail-sidebar--collapsed');
    await ui.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(sidebar).not.toHaveClass('hc-task-detail-sidebar--collapsed');

    // Show dependency install results in the task sidebar for debugging. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    expect(screen.getByText('Dependency installs')).toBeInTheDocument();
    expect(screen.getByText('Workdir: backend')).toBeInTheDocument();
    expect(screen.getByText('Error: exit code 1')).toBeInTheDocument();

    // Validate dependency filter + sort + grouping toggles in task detail UI. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const filterGroup = screen.getByTestId('dependency-filter');
    await ui.click(within(filterGroup).getByText('Failed'));
    expect(screen.getAllByTestId(/dependency-step-/)).toHaveLength(1);

    await ui.click(within(filterGroup).getByText('All'));
    const showButtons = screen.getAllByRole('button', { name: 'Show details' });
    await ui.click(showButtons[0]);
    expect(screen.getByText('Command: pnpm install --frozen-lockfile')).toBeInTheDocument();

    const keywordInput = screen.getByPlaceholderText('Search command, error, workdir, language');
    await ui.type(keywordInput, 'pip');
    expect(screen.getAllByTestId(/dependency-step-/)).toHaveLength(1);
    await ui.clear(keywordInput);

    const sortSelect = screen.getByLabelText('Sort');
    await ui.click(sortSelect);
    await ui.click(screen.getByText('Duration'));

    const directionSelect = screen.getByLabelText('Direction');
    await ui.click(directionSelect);
    await ui.click(screen.getByText('Descending'));

    const sortedSteps = screen.getAllByTestId(/dependency-step-/);
    expect(within(sortedSteps[0]).getByText('python')).toBeInTheDocument();

    const groupSwitch = screen.getByRole('switch', { name: 'Group by workdir' });
    await ui.click(groupSwitch);
    expect(screen.getByText('Workdir: backend')).toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => expect(api.retryTask).toHaveBeenCalledWith('t1', undefined));

    await ui.click(screen.getByRole('button', { name: /^delete Delete$/i }));
    await ui.click(await screen.findByRole('button', { name: /^Delete$/ }));

    await waitFor(() => expect(api.deleteTask).toHaveBeenCalledWith('t1'));
    expect(window.location.hash).toBe('#/tasks');
  });

  // Ensure queued tasks show a diagnosis hint and a retry button in the page header actions. f3a9c2d8e1b7f4a0c6d1
  test('shows queue hint + retry when task is queued', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTask).mockResolvedValueOnce({
      id: 'tq1',
      eventType: 'chat',
      title: 'Task tq1',
      status: 'queued',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true },
      queue: { reasonCode: 'no_active_worker', ahead: 0, queuedTotal: 1, processing: 0, staleProcessing: 0, inlineWorkerEnabled: true },
      repoId: 'r1',
      repoProvider: 'gitlab',
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo r1', enabled: true },
      robotId: 'bot1',
      robot: { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true },
      payload: { user_name: 'Alice', user_username: 'alice' }
    } as any);

    renderPage({ taskId: 'tq1' });

    await waitFor(() => expect(api.fetchTask).toHaveBeenCalled());
    expect(await screen.findByText('No running tasks detected; worker may be offline or not triggered')).toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => expect(api.retryTask).toHaveBeenCalledWith('tq1', undefined));
  });

  // Ensure time-window blocked queued tasks show execute-now action. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  test('shows execute-now when queued task is outside time window', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTask).mockResolvedValueOnce({
      id: 'tq2',
      eventType: 'chat',
      title: 'Task tq2',
      status: 'queued',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true },
      queue: { reasonCode: 'outside_time_window', ahead: 0, queuedTotal: 1, processing: 0, staleProcessing: 0, inlineWorkerEnabled: true },
      repoId: 'r1',
      repoProvider: 'gitlab',
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo r1', enabled: true },
      robotId: 'bot1',
      robot: { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true },
      payload: { user_name: 'Alice', user_username: 'alice' }
    } as any);

    renderPage({ taskId: 'tq2' });

    await waitFor(() => expect(api.fetchTask).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: /Run now/i }));
    await waitFor(() => expect(api.executeTaskNow).toHaveBeenCalledWith('tq2'));
  });

  // Verify pause control in task detail header actions. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  test('pauses a processing task from the header actions', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTask).mockResolvedValueOnce({
      id: 't_pause',
      eventType: 'chat',
      title: 'Task pause',
      status: 'processing',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true },
      repoId: 'r1',
      repoProvider: 'gitlab',
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo r1', enabled: true },
      robotId: 'bot1',
      robot: { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true },
      payload: { user_name: 'Alice', user_username: 'alice' }
    } as any);

    renderPage({ taskId: 't_pause' });

    // Match the accessible name that includes the AntD icon label. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    const pauseButton = await screen.findByRole('button', { name: /Pause/ });
    await ui.click(pauseButton);

    await waitFor(() => expect(api.pauseTask).toHaveBeenCalledWith('t_pause'));
  });

  // Verify resume control in task detail header actions. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  test('resumes a paused task from the header actions', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTask).mockResolvedValueOnce({
      id: 't_resume',
      eventType: 'chat',
      title: 'Task resume',
      status: 'paused',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true },
      repoId: 'r1',
      repoProvider: 'gitlab',
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo r1', enabled: true },
      robotId: 'bot1',
      robot: { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true },
      payload: { user_name: 'Alice', user_username: 'alice' }
    } as any);

    renderPage({ taskId: 't_resume' });

    // Match the accessible name that includes the AntD icon label. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    const resumeButton = await screen.findByRole('button', { name: /Resume/ });
    await ui.click(resumeButton);

    await waitFor(() => expect(api.resumeTask).toHaveBeenCalledWith('t_resume'));
  });

  test('shows prompt patch template + rendered preview side-by-side', async () => {
    // Ensure the task detail prompt patch shows both raw template and rendered preview. x0kprszlsorw9vi8jih9
    const ui = userEvent.setup();
    vi.mocked(api.fetchTask).mockResolvedValueOnce({
      id: 'tp1',
      eventType: 'issue',
      title: 'Task tp1',
      status: 'succeeded',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true },
      issueId: 42,
      promptCustom: 'Issue={{issue.number}} Repo={{repo.name}} Robot={{robot.name}}',
      repoId: 'r1',
      repoProvider: 'gitlab',
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo r1', enabled: true },
      robotId: 'bot1',
      robot: { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true },
      payload: { project: { path_with_namespace: 'demo/repo' } }
    } as any);

    renderPage({ taskId: 'tp1' });
    await waitFor(() => expect(api.fetchTask).toHaveBeenCalled());

    await ui.click(screen.getByText('Prompt patch (repo config)'));
    expect(await screen.findByText('Template')).toBeInTheDocument();
    expect(screen.getByText('Rendered')).toBeInTheDocument();
    expect(screen.getByText('Issue={{issue.number}} Repo={{repo.name}} Robot={{robot.name}}')).toBeInTheDocument();
    expect(screen.getByText('Issue=42 Repo=Repo r1 Robot=Robot bot1')).toBeInTheDocument();
  });
});
