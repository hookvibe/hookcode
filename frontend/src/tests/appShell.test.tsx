import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import App from '../App';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => {
  const makeTask = (id: string, title: string, status: any, updatedAt?: string) => {
    // Test helper:
    // - Use "recent" timestamps by default so the sidebar auto-expands the status sections.
    const when = updatedAt ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return {
      id,
      eventType: 'chat',
      title,
      status,
      retries: 0,
      createdAt: when,
      updatedAt: when
    };
  };

  return {
    __esModule: true,
    fetchAuthMe: vi.fn(async () => ({
      authEnabled: true,
      user: { id: 'u', username: 'u', displayName: 'User' },
      features: { taskLogsEnabled: true }
    })),
    fetchTaskStats: vi.fn(async () => ({ total: 7, queued: 5, processing: 1, success: 1, failed: 0 })),
    fetchTasks: vi.fn(async (options?: any) => {
      const status = options?.status;
      if (status === 'queued')
        return [
          makeTask('t_q1', 'Queued task 1', 'queued'),
          makeTask('t_q2', 'Queued task 2', 'queued'),
          makeTask('t_q3', 'Queued task 3', 'queued'),
          makeTask('t_q4', 'Queued task 4', 'queued'),
          makeTask('t_q5', 'Queued task 5', 'queued')
        ];
      if (status === 'processing') return [makeTask('t_p1', 'Processing task 1', 'processing')];
      if (status === 'success') return [makeTask('t_s1', 'Done task 1', 'succeeded')];
      if (status === 'failed') return [];
      return [makeTask('t_all', 'Any task', 'queued')];
    }),
    fetchTaskGroups: vi.fn(async () => [
      { id: 'g1', kind: 'chat', bindingKey: 'b1', title: 'Group 1', createdAt: '', updatedAt: '2026-01-11T00:00:00.000Z' }
    ]),
    listRepos: vi.fn(async () => [
      { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true, createdAt: '', updatedAt: '2026-01-11T00:00:00.000Z' }
    ]),
    listRepoRobots: vi.fn(async () => []),
    fetchRepo: vi.fn(async (id: string) => ({
      repo: { id, provider: 'gitlab', name: `Repo ${id}`, enabled: true, createdAt: '', updatedAt: '2026-01-11T00:00:00.000Z' },
      robots: [],
      automationConfig: null,
      webhookSecret: null,
      webhookPath: null,
      repoScopedCredentials: { repoProvider: { hasToken: false }, modelProvider: { codex: { hasApiKey: false }, claude_code: { hasApiKey: false } } }
    })),
    createRepo: vi.fn(async () => ({
      repo: { id: 'r_new', provider: 'gitlab', name: 'Repo new', enabled: true, createdAt: '', updatedAt: '' },
      webhookSecret: 's',
      webhookPath: '/webhook'
    })),
    updateRepo: vi.fn(async () => ({ repo: { id: 'r1' }, repoScopedCredentials: null })),
    fetchMe: vi.fn(async () => ({ id: 'u', username: 'u', displayName: 'User', roles: [], createdAt: '', updatedAt: '' })),
    updateMe: vi.fn(async () => ({ id: 'u', username: 'u', displayName: 'User', roles: [], createdAt: '', updatedAt: '' })),
    changeMyPassword: vi.fn(async () => undefined),
    fetchMyModelCredentials: vi.fn(async () => ({ codex: { hasApiKey: false }, claude_code: { hasApiKey: false }, gitlab: { profiles: [] }, github: { profiles: [] } })),
    updateMyModelCredentials: vi.fn(async () => ({ codex: { hasApiKey: false }, claude_code: { hasApiKey: false }, gitlab: { profiles: [] }, github: { profiles: [] } })),
    fetchAdminToolsMeta: vi.fn(async () => ({ enabled: true, ports: { prisma: 7215, swagger: 7216 } })),
    fetchTask: vi.fn(async (id: string) => makeTask(id, `Task ${id}`, 'succeeded')),
    fetchTaskGroup: vi.fn(async (id: string) => ({
      id,
      kind: 'chat',
      bindingKey: 'b1',
      title: `Group ${id}`,
      createdAt: '',
      updatedAt: '2026-01-11T00:00:00.000Z'
    })),
    fetchTaskGroupTasks: vi.fn(async () => []),
    executeChat: vi.fn(async () => ({
      taskGroup: { id: 'g_new', kind: 'chat', bindingKey: 'b1', title: 'Group new', createdAt: '', updatedAt: '' },
      task: makeTask('t_new', 'New task', 'queued')
    })),
    login: vi.fn(async () => ({ token: 't', expiresAt: '', user: { id: 'u', username: 'u' } }))
  };
});

const renderApp = () =>
  render(
    <AntdApp>
      <App />
    </AntdApp>
  );

describe('AppShell (frontend-chat migration)', () => {
  beforeEach(() => {
    // Test isolation: restore API mock implementations to the defaults defined in `vi.mock(...)`.
    vi.resetAllMocks();
    setLocale('en-US');
    window.location.hash = '#/';
    window.localStorage.setItem('hookcode-token', 'test-token');
  });

  test('renders home page and sidebar sections', async () => {
    renderApp();

    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New task group/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();

    // UX: in expanded mode, task status icons are shown on each task row (not on the status header).
    const queuedHeader = await screen.findByRole('button', { name: 'Queued' });
    expect(queuedHeader.querySelector('.ant-btn-icon')).toBeNull();

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(await screen.findByText('Queued task 1')).toBeInTheDocument();
    expect(await screen.findByText('Processing task 1')).toBeInTheDocument();
    expect(await screen.findByText('Done task 1')).toBeInTheDocument();
    // Business intent: show top 3 tasks per status section by default.
    expect(screen.queryByText('Queued task 4')).not.toBeInTheDocument();

    const queuedItemButton = await screen.findByRole('button', { name: /Queued task 1/ });
    expect(queuedItemButton.querySelector('.hc-sider-item__icon')).toBeTruthy();
    // UX: when a status has > 3 tasks, render a "View all" entry at the end of the preview list.
    const viewAllButton = await screen.findByRole('button', { name: /View all/i });
    expect(viewAllButton.querySelector('.hc-sider-item__icon')).toBeTruthy();
    // UX: empty sections should start collapsed so the "No tasks" hint does not show unless expanded.
    await waitFor(() => expect(screen.queryByText('No tasks')).not.toBeInTheDocument());

    expect(await screen.findByText('Task groups')).toBeInTheDocument();
    const groupLabel = await screen.findByText('Group 1');
    const groupItem = groupLabel.closest('li');
    expect(groupItem?.querySelector('.ant-menu-item-icon, .anticon')).toBeTruthy();
  });

  test('navigates to tasks list when clicking "View all" in a status section', async () => {
    const ui = userEvent.setup();
    renderApp();

    const viewAllButton = await screen.findByRole('button', { name: /View all/i });
    await ui.click(viewAllButton);

    expect(window.location.hash).toBe('#/tasks?status=queued');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByPlaceholderText('Search tasks (title/repo/id)')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /View all/i })).toHaveClass('hc-sider-item--active');
  });

  test('navigates to task detail when clicking a task item', async () => {
    const ui = userEvent.setup();
    renderApp();

    const taskButton = await screen.findByRole('button', { name: /Queued task 1/ });
    await ui.click(taskButton);

    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('Task t_q1', { selector: '.hc-page__title' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Queued task 1/ })).toHaveClass('hc-sider-item--active');
  });

  test('navigates to task group chat when clicking a task group item', async () => {
    const ui = userEvent.setup();
    renderApp();

    const groupItem = await screen.findByText('Group 1');
    await ui.click(groupItem);

    expect(window.location.hash).toBe('#/task-groups/g1');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('Group g1')).toBeInTheDocument();
  });

  test('collapses a task status section without affecting other sections', async () => {
    const ui = userEvent.setup();
    renderApp();

    expect(await screen.findByText('Queued task 1')).toBeInTheDocument();
    expect(await screen.findByText('Processing task 1')).toBeInTheDocument();

    const queuedHeader = await screen.findByRole('button', { name: 'Queued' });
    await ui.click(queuedHeader);

    expect(screen.queryByText('Queued task 1')).not.toBeInTheDocument();
    expect(screen.getByText('Processing task 1')).toBeInTheDocument();
  });

  test('keeps a status collapsed when only old tasks exist', async () => {
    const ui = userEvent.setup();
    const fetchTasksMock = vi.mocked(api.fetchTasks);
    const fetchTaskStatsMock = vi.mocked(api.fetchTaskStats);

    const now = Date.now();
    const recent = new Date(now - 60 * 60 * 1000).toISOString();
    const old = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    const makeTask = (id: string, title: string, status: any, when: string) => ({
      id,
      eventType: 'chat',
      title,
      status,
      retries: 0,
      createdAt: when,
      updatedAt: when
    });

    // Test setup:
    // - processing has tasks, but they are older than 24 hours -> should remain collapsed by default.
    fetchTaskStatsMock.mockResolvedValueOnce({ total: 2, queued: 1, processing: 1, success: 0, failed: 0 });
    fetchTasksMock.mockImplementation(async (options?: any) => {
      const status = options?.status;
      if (status === 'queued') return [makeTask('t_q1', 'Queued task 1', 'queued', recent)];
      if (status === 'processing') return [makeTask('t_p1', 'Processing task 1', 'processing', old)];
      return [];
    });

    renderApp();

    expect(await screen.findByText('Queued task 1')).toBeInTheDocument();
    expect(screen.queryByText('Processing task 1')).not.toBeInTheDocument();

    const processingHeader = await screen.findByRole('button', { name: 'Processing' });
    await ui.click(processingHeader);
    expect(await screen.findByText('Processing task 1')).toBeInTheDocument();
  });

  test('redirects #/login to home when already signed in', async () => {
    window.location.hash = '#/login';
    renderApp();

    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();
  });

  test('navigates to home after login even when legacy login-next points to #/login', async () => {
    const ui = userEvent.setup();

    // Regression guard:
    // - Some legacy deployments may leave `hookcode-login-next` as `#/login` in sessionStorage.
    // - The post-login flow must ignore it and fall back to `#/` to avoid getting stuck on the login route.
    window.localStorage.removeItem('hookcode-token');
    window.sessionStorage.setItem('hookcode-login-next', '#/login');
    window.location.hash = '#/login';

    renderApp();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    await ui.type(screen.getByLabelText('Username'), 'u');
    await ui.type(screen.getByLabelText('Password'), 'p');
    await ui.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(window.location.hash).toBe('#/'));
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();
  });

  test('shows home after login even when hash is already #/', async () => {
    const ui = userEvent.setup();

    // UX rule: users can land on `#/` while unauthenticated (guard shows login page without changing the hash).
    // After a successful login, the app must still transition to Home even though the hash does not change.
    window.localStorage.removeItem('hookcode-token');
    window.location.hash = '#/';

    renderApp();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    await ui.type(screen.getByLabelText('Username'), 'u');
    await ui.type(screen.getByLabelText('Password'), 'p');
    await ui.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();
  });

  test('navigates to repositories page from sidebar nav', async () => {
    const ui = userEvent.setup();
    renderApp();

    const reposButton = await screen.findByRole('button', { name: /Repositories/i });
    await ui.click(reposButton);

    expect(window.location.hash).toBe('#/repos');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByPlaceholderText('Search repositories (name/id/platform)')).toBeInTheDocument();
    expect(await screen.findByText('Repo 1')).toBeInTheDocument();
  });

  test('cuts off header back chain when navigating to task detail from sidebar', async () => {
    const ui = userEvent.setup();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderApp();

    // Start from a different page so we can verify the back chain is intentionally cleared.
    const reposButton = await screen.findByRole('button', { name: /Repositories/i });
    await ui.click(reposButton);
    expect(window.location.hash).toBe('#/repos');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByPlaceholderText('Search repositories (name/id/platform)')).toBeInTheDocument();

    const taskButton = await screen.findByRole('button', { name: /Queued task 1/ });
    await ui.click(taskButton);

    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('Task t_q1', { selector: '.hc-page__title' })).toBeInTheDocument();

    // Business rule: sidebar navigation clears the header-back chain, so the back icon falls back to `#/tasks`.
    const backButton = await screen.findByRole('button', { name: 'Back to list' });
    await ui.click(backButton);
    expect(backSpy).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/tasks');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByPlaceholderText('Search tasks (title/repo/id)')).toBeInTheDocument();

    backSpy.mockRestore();
  });

  test('cuts off header back chain when clicking the active task in sidebar', async () => {
    const ui = userEvent.setup();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderApp();

    // Simulate a "content navigation" into task detail so the previous hash is a non-task page (repo detail),
    // then re-enter the same task via the sidebar (hash does not change) to ensure the back chain is still cleared.
    window.location.hash = '#/repos/r1';
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('Repo r1', { selector: '.hc-page__title' })).toBeInTheDocument();

    window.location.hash = '#/tasks/t_q1';
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('Task t_q1', { selector: '.hc-page__title' })).toBeInTheDocument();

    const sidebarTask = await screen.findByRole('button', { name: /Queued task 1/ });
    await ui.click(sidebarTask);

    const backButton = await screen.findByRole('button', { name: 'Back to list' });
    await ui.click(backButton);
    expect(backSpy).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/tasks');

    backSpy.mockRestore();
  });

  test('uses browser history for header back when opened from task list', async () => {
    const ui = userEvent.setup();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderApp();

    const viewAllButton = await screen.findByRole('button', { name: /View all/i });
    await ui.click(viewAllButton);
    expect(window.location.hash).toBe('#/tasks?status=queued');
    window.dispatchEvent(new Event('hashchange'));

    const tasksSearch = await screen.findByPlaceholderText('Search tasks (title/repo/id)');
    const tasksPage = tasksSearch.closest('.hc-page');
    expect(tasksPage).toBeTruthy();

    const taskCardTitle = within(tasksPage as HTMLElement).getByText('Queued task 1');
    await ui.click(taskCardTitle);
    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));

    expect(await screen.findByText('Task t_q1', { selector: '.hc-page__title' })).toBeInTheDocument();
    const backButton = await screen.findByRole('button', { name: 'Back to list' });
    await ui.click(backButton);
    expect(backSpy).toHaveBeenCalledTimes(1);

    backSpy.mockRestore();
  });

  test('supports repo detail back to task detail when opened with ?from=task', async () => {
    const ui = userEvent.setup();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderApp();

    const taskButton = await screen.findByRole('button', { name: /Queued task 1/ });
    await ui.click(taskButton);
    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('Task t_q1', { selector: '.hc-page__title' })).toBeInTheDocument();

    // Simulate a deep link coming from TaskDetail (hash query is used as the explicit referrer).
    window.location.hash = '#/repos/r1?from=task&taskId=t_q1';
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByText('Repo r1', { selector: '.hc-page__title' })).toBeInTheDocument();

    const backButton = await screen.findByRole('button', { name: 'Back to task detail' });
    await ui.click(backButton);
    expect(backSpy).toHaveBeenCalledTimes(1);

    backSpy.mockRestore();
  });
});
