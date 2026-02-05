import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import App from '../App';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => {
  const makeTask = (params: {
    id: string;
    title: string;
    status: any;
    when?: string;
    eventType?: any;
    issueId?: number;
    mrId?: number;
    payload?: any;
    repo?: any;
  }) => {
    // Test helper:
    // - Use "recent" timestamps by default so the sidebar auto-expands the status sections.
    const when = params.when ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return {
      id: params.id,
      eventType: params.eventType ?? 'issue',
      title: params.title,
      status: params.status,
      issueId: params.issueId,
      mrId: params.mrId,
      payload: params.payload,
      repo: params.repo ?? { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true },
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
    // Mock the aggregated dashboard sidebar snapshot API used by AppShell polling. 7bqwou6abx4ste96ikhv
    fetchDashboardSidebar: vi.fn(async () => ({
      // Include paused in mocked stats to match API shape. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      stats: { total: 7, queued: 5, processing: 1, paused: 0, success: 1, failed: 0 },
      tasksByStatus: {
        queued: [
          makeTask({ id: 't_q1', title: 'Queued task 1', status: 'queued', eventType: 'issue', issueId: 1 }),
          makeTask({ id: 't_q2', title: 'Queued task 2', status: 'queued', eventType: 'issue', issueId: 2 }),
          makeTask({ id: 't_q3', title: 'Queued task 3', status: 'queued', eventType: 'issue', issueId: 3 })
        ],
        processing: [
          makeTask({
            id: 't_p1',
            title: 'Processing task 1',
            status: 'processing',
            eventType: 'commit',
            payload: { after: 'abcdef1234567890abcdef1234567890abcdef12' }
          })
        ],
        success: [makeTask({ id: 't_s1', title: 'Done task 1', status: 'succeeded', eventType: 'merge_request', mrId: 7 })],
        failed: []
      },
      taskGroups: [
        { id: 'g1', kind: 'chat', bindingKey: 'b1', title: 'Group 1', createdAt: '', updatedAt: '2026-01-11T00:00:00.000Z' }
      ]
    })),
    // Mock preview visibility updates so chat pages can report hidden state. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
    setTaskGroupPreviewVisibility: vi.fn(async () => ({ success: true })),
    // Mirror paused counts in task stats mocks for sidebar updates. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    fetchTaskStats: vi.fn(async () => ({ total: 7, queued: 5, processing: 1, paused: 0, success: 1, failed: 0 })),
    // Mock the daily task volume series used by the repo dashboard line chart. dashtrendline20260119m9v2
    fetchTaskVolumeByDay: vi.fn(async () => []),
    fetchTasks: vi.fn(async (options?: any) => {
      const status = options?.status;
      if (status === 'queued')
        return [
          makeTask({ id: 't_q1', title: 'Queued task 1', status: 'queued', eventType: 'issue', issueId: 1 }),
          makeTask({ id: 't_q2', title: 'Queued task 2', status: 'queued', eventType: 'issue', issueId: 2 }),
          makeTask({ id: 't_q3', title: 'Queued task 3', status: 'queued', eventType: 'issue', issueId: 3 }),
          makeTask({ id: 't_q4', title: 'Queued task 4', status: 'queued', eventType: 'issue', issueId: 4 }),
          makeTask({ id: 't_q5', title: 'Queued task 5', status: 'queued', eventType: 'issue', issueId: 5 })
        ];
      if (status === 'processing')
        return [
          makeTask({
            id: 't_p1',
            title: 'Processing task 1',
            status: 'processing',
            eventType: 'commit',
            payload: { after: 'abcdef1234567890abcdef1234567890abcdef12' }
          })
        ];
      if (status === 'success') return [makeTask({ id: 't_s1', title: 'Done task 1', status: 'succeeded', eventType: 'merge_request', mrId: 7 })];
      if (status === 'failed') return [];
      return [makeTask({ id: 't_all', title: 'Any task', status: 'queued', eventType: 'issue', issueId: 99 })];
    }),
    fetchTaskGroups: vi.fn(async () => [
      { id: 'g1', kind: 'chat', bindingKey: 'b1', title: 'Group 1', createdAt: '', updatedAt: '2026-01-11T00:00:00.000Z' }
    ]),
    listRepos: vi.fn(async () => [
      { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true, createdAt: '', updatedAt: '2026-01-11T00:00:00.000Z' }
    ]),
    // Expose archive APIs in the mock so ArchivePage / RepoDetailPage can render safely. qnp1mtxhzikhbi0xspbc
    archiveRepo: vi.fn(async () => ({ repo: { id: 'r1' }, tasksArchived: 0, taskGroupsArchived: 0 })),
    unarchiveRepo: vi.fn(async () => ({ repo: { id: 'r1' }, tasksRestored: 0, taskGroupsRestored: 0 })),
    listRepoRobots: vi.fn(async () => []),
    fetchRepo: vi.fn(async (id: string) => ({
      repo: { id, provider: 'gitlab', name: `Repo ${id}`, enabled: true, createdAt: '', updatedAt: '2026-01-11T00:00:00.000Z' },
      robots: [],
      automationConfig: null,
      webhookSecret: null,
      webhookPath: null,
      // Change record: repo-scoped credentials now expose `profiles[]` for both repo/model providers.
      repoScopedCredentials: {
        repoProvider: { profiles: [], defaultProfileId: null },
        modelProvider: {
          codex: { profiles: [], defaultProfileId: null },
          claude_code: { profiles: [], defaultProfileId: null },
          gemini_cli: { profiles: [], defaultProfileId: null }
        }
      }
    })),
    createRepo: vi.fn(async () => ({
      repo: { id: 'r_new', provider: 'gitlab', name: 'Repo new', enabled: true, createdAt: '', updatedAt: '' },
      webhookSecret: 's',
      webhookPath: '/webhook'
    })),
    updateRepo: vi.fn(async () => ({ repo: { id: 'r1' }, repoScopedCredentials: null })),
    fetchMe: vi.fn(async () => ({ id: 'u', username: 'u', displayName: 'User', roles: [], createdAt: '', updatedAt: '' })),
    updateMe: vi.fn(async () => ({ id: 'u', username: 'u', displayName: 'User', roles: [], createdAt: '', updatedAt: '' })),
    // Mock createMyApiToken to satisfy UserPanelPopover API usage in AppShell tests. docs/en/developer/plans/account-edit-feature-toggle-test/task_plan.md account-edit-feature-toggle-test
    createMyApiToken: vi.fn(async () => ({ token: { id: 'tok1', name: 'Token 1', prefix: 'hc', createdAt: '', lastUsedAt: null } })),
    // Mock PAT API helpers used by UserPanelPopover so module imports do not fail. docs/en/developer/plans/account-edit-feature-toggle-test/task_plan.md account-edit-feature-toggle-test
    fetchMyApiTokens: vi.fn(async () => []),
    updateMyApiToken: vi.fn(async () => ({ id: 'tok1', name: 'Token 1', prefix: 'hc', createdAt: '', lastUsedAt: null })),
    revokeMyApiToken: vi.fn(async () => ({ id: 'tok1', name: 'Token 1', prefix: 'hc', createdAt: '', lastUsedAt: null })),
    changeMyPassword: vi.fn(async () => undefined),
    fetchMyModelCredentials: vi.fn(async () => ({
      codex: { profiles: [], defaultProfileId: null },
      claude_code: { profiles: [], defaultProfileId: null },
      gemini_cli: { profiles: [], defaultProfileId: null },
      gitlab: { profiles: [], defaultProfileId: null },
      github: { profiles: [], defaultProfileId: null }
    })),
    // Mock model discovery API used by UserPanelPopover credentials tab. docs/en/developer/plans/account-edit-feature-toggle-test/task_plan.md account-edit-feature-toggle-test
    listMyModelProviderModels: vi.fn(async () => ({ models: [], source: 'fallback' })),
    fetchRepoProviderMeta: vi.fn(async () => ({ provider: 'gitlab', visibility: 'unknown' })), // Mock provider visibility for repo activity row. kzxac35mxk0fg358i7zs
    fetchRepoProviderActivity: vi.fn(async () => ({
      provider: 'gitlab',
      commits: { items: [], page: 1, pageSize: 5, hasMore: false },
      merges: { items: [], page: 1, pageSize: 5, hasMore: false },
      issues: { items: [], page: 1, pageSize: 5, hasMore: false }
    })), // Mock provider activity for provider activity row. kzxac35mxk0fg358i7zs
    // Mock preview config discovery so RepoDetailPage can render safely. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    fetchRepoPreviewConfig: vi.fn(async () => ({ available: false, instances: [], reason: 'config_missing' })),
    // Provide webhook delivery mocks for shared repo dashboard cards to avoid missing export errors. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    listRepoWebhookDeliveries: vi.fn(async () => ({ deliveries: [], nextCursor: undefined })),
    fetchRepoWebhookDelivery: vi.fn(async () => ({
      id: 'd1',
      repoId: 'r1',
      provider: 'github',
      eventName: 'push',
      result: 'accepted',
      httpStatus: 200,
      code: 'ok',
      message: 'accepted',
      taskIds: ['t1'],
      createdAt: '2026-01-28T00:00:00.000Z',
      payload: { foo: 'bar' },
      response: { status: 'ok' }
    })),
    updateMyModelCredentials: vi.fn(async () => ({
      codex: { profiles: [], defaultProfileId: null },
      claude_code: { profiles: [], defaultProfileId: null },
      gemini_cli: { profiles: [], defaultProfileId: null },
      gitlab: { profiles: [], defaultProfileId: null },
      github: { profiles: [], defaultProfileId: null }
    })),
    fetchAdminToolsMeta: vi.fn(async () => ({ enabled: true, ports: { prisma: 7215, swagger: 7216 } })),
    // Provide runtime API mocks for environment tab usage. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    fetchSystemRuntimes: vi.fn(async () => ({ runtimes: [], detectedAt: null })),
    fetchTask: vi.fn(async (id: string) => makeTask({ id, title: `Task ${id}`, status: 'succeeded', eventType: 'issue', issueId: 1 })),
    fetchTaskGroup: vi.fn(async (id: string) => ({
      id,
      kind: 'chat',
      bindingKey: 'b1',
      title: `Group ${id}`,
      createdAt: '',
      updatedAt: '2026-01-11T00:00:00.000Z'
    })),
    // Provide preview status mock for TaskGroupChatPage side effects. docs/en/developer/plans/test-output-noise-20260129/task_plan.md test-output-noise-20260129
    fetchTaskGroupPreviewStatus: vi.fn(async () => ({ available: false, instances: [] })),
    fetchTaskGroupTasks: vi.fn(async () => []),
    executeChat: vi.fn(async () => ({
      taskGroup: { id: 'g_new', kind: 'chat', bindingKey: 'b1', title: 'Group new', createdAt: '', updatedAt: '' },
      task: makeTask({ id: 't_new', title: 'New task', status: 'queued', eventType: 'issue', issueId: 123 })
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
    // Query sidebar toggle by title to match the modern sidebar button markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument();

    // UX: in expanded mode, task status icons are shown on each task row (not on the status header).
    // Match the queued header label with count in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const queuedHeader = await screen.findByRole('button', { name: /Queued/ });
    expect(queuedHeader.querySelector('.ant-btn-icon')).toBeNull();

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(await screen.findByText('Issue #1')).toBeInTheDocument();
    expect(await screen.findByText('Commit abcdef1')).toBeInTheDocument();
    expect(await screen.findByText('Merge request !7')).toBeInTheDocument();
    // Business intent: show top 3 tasks per status section by default.
    expect(screen.queryByText('Issue #4')).not.toBeInTheDocument();

    const queuedItemButton = await screen.findByRole('button', { name: /Issue #1/ });
    // Align task row icon selector with modern sidebar classes. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(queuedItemButton.querySelector('.hc-nav-icon')).toBeTruthy();
    // Sidebar task rows should render a 2-line label (event+marker, then repo). mks8pr4r3m1fo9oqx9av
    expect(within(queuedItemButton).getByText('Repo 1')).toBeInTheDocument();
    // UX: when a status has > 3 tasks, render a "View all" entry at the end of the preview list.
    // Test note: locate the "View all" button via its label (icon aria-label may be included in the accessible name). kwq0evw438cxawea0lcj
    const viewAllLabel = await screen.findByText('View all');
    const viewAllButton = viewAllLabel.closest('button');
    expect(viewAllButton).toBeTruthy();
    // View All redesign: render a trailing arrow to reinforce navigation. docs/en/developer/plans/sidebarviewall20260128/task_plan.md sidebarviewall20260128
    // Align view-all row marker with modern sidebar classes. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(viewAllButton).toHaveClass('hc-nav-view-all');
    // UX: empty sections should start collapsed so the "No tasks" hint does not show unless expanded.
    await waitFor(() => expect(screen.queryByText('No tasks')).not.toBeInTheDocument());

    expect(await screen.findByText('Task groups')).toBeInTheDocument();
    const groupLabel = await screen.findByText('Group 1');
    const groupItem = groupLabel.closest('button');
    // Align task group icon selector with modern sidebar markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(groupItem?.querySelector('.hc-nav-icon')).toBeTruthy();
  });

  test('does not render preview dots for running task groups in the modern sidebar', async () => {
    // Modern sidebar removes preview dots; keep the test aligned with the new baseline. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const fetchDashboardSidebarMock = vi.mocked(api.fetchDashboardSidebar);
    fetchDashboardSidebarMock.mockResolvedValue({
      // Include paused counts to keep stats shape aligned. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      stats: { total: 0, queued: 0, processing: 0, paused: 0, success: 0, failed: 0 },
      tasksByStatus: { queued: [], processing: [], success: [], failed: [] },
      taskGroups: [
        {
          id: 'g1',
          kind: 'chat',
          bindingKey: 'b1',
          title: 'Group 1',
          previewActive: true,
          createdAt: '',
          updatedAt: '2026-01-11T00:00:00.000Z'
        }
      ]
    } as any);

    renderApp();

    const label = await screen.findByText('Group 1');
    // Preview dots are no longer rendered in the modern sidebar layout. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(document.querySelector('.hc-sider-preview-dot')).toBeNull();
    expect(label).toBeInTheDocument();
  });

  test('renders sidebar dividers in expanded and collapsed modes', async () => {
    // Divider UX: keep section separators visible regardless of sidebar collapse state. docs/en/developer/plans/sidebarviewall20260128/task_plan.md sidebarviewall20260128
    const ui = userEvent.setup();
    renderApp();

    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();
    // Align divider selectors with modern sidebar classes. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(document.querySelectorAll('.hc-sidebar-divider')).toHaveLength(2);

    // Locate the sidebar toggle via its title attribute in the refreshed layout. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const collapseButton = await screen.findByTitle('Collapse sidebar');
    await ui.click(collapseButton);
    // Confirm the expanded toggle uses the title label in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByTitle('Expand sidebar')).toBeInTheDocument();
    // Align divider selectors with modern sidebar classes. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(document.querySelectorAll('.hc-sidebar-divider')).toHaveLength(2);
  });

  test('hides task groups when collapsed but keeps the view-all icon', async () => {
    // Ensure collapsed sidebar shows only the task-group view-all icon CTA. docs/en/developer/plans/sidebar-menu-20260131/task_plan.md sidebar-menu-20260131
    const ui = userEvent.setup();
    renderApp();

    expect(await screen.findByText('Group 1')).toBeInTheDocument();
    // Locate the sidebar toggle via its title attribute in the refreshed layout. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const collapseButton = await screen.findByTitle('Collapse sidebar');
    await ui.click(collapseButton);

    // Confirm the expanded toggle uses the title label in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByTitle('Expand sidebar')).toBeInTheDocument();
    expect(screen.queryByText('Group 1')).toBeNull();
    // Query the task-group view-all control by its title in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByTitle('View all task groups')).toBeInTheDocument();
  });

  test('persists sidebar collapsed state across refresh', async () => {
    // Persist the sidebar collapsed preference via localStorage so it survives a remount. l7pvyrepxb0mx2ipdh2y
    const ui = userEvent.setup();
    const first = renderApp();

    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();

    // Locate the sidebar toggle via its title attribute in the refreshed layout. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const collapseButton = await screen.findByTitle('Collapse sidebar');
    await ui.click(collapseButton);

    await waitFor(() => expect(window.localStorage.getItem('hookcode-sider-collapsed')).toBe('1'));
    // Confirm the expanded toggle uses the title label in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByTitle('Expand sidebar')).toBeInTheDocument();
    // Align brand selector with modern sidebar classes. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(document.querySelector('.hc-sidebar-brand')).toBeNull();

    first.unmount();
    renderApp();
    // Confirm the expanded toggle uses the title label in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByTitle('Expand sidebar')).toBeInTheDocument();
  });

  test('spins processing icon in collapsed sidebar only when processing tasks exist', async () => {
    // Ensure the collapsed-mode Processing indicator does not animate when processing count is 0. l7pvyrepxb0mx2ipdh2y
    const ui = userEvent.setup();
    renderApp();

    expect(await screen.findByText('Commit abcdef1')).toBeInTheDocument();

    // Locate the sidebar toggle via its title attribute in the refreshed layout. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const collapseButton = await screen.findByTitle('Collapse sidebar');
    await ui.click(collapseButton);
    // Confirm the expanded toggle uses the title label in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByTitle('Expand sidebar')).toBeInTheDocument();

    // Validate the processing badge count in collapsed mode with modern sidebar markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const processingHeader = await screen.findByTitle('Processing');
    const processingBadge = processingHeader.querySelector('.hc-nav-badge');
    expect(processingBadge).toBeTruthy();
    expect(processingBadge).toHaveTextContent('1');
  });

  test('navigates to Archive page via the sidebar bottom icon', async () => {
    // Ensure the Archive entry is discoverable via the bottom sidebar icon. qnp1mtxhzikhbi0xspbc
    const ui = userEvent.setup();
    renderApp();

    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();
    // Query the archive nav item by title in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    await ui.click(screen.getByTitle('Archive'));
    expect(window.location.hash).toBe('#/archive');

    expect(await screen.findByText('Archived repositories and tasks')).toBeInTheDocument();
  });

  test('keeps processing icon static in collapsed sidebar when there are no processing tasks', async () => {
    // Regression guard: LoadingOutlined spins by default; disable it when processing === 0 in collapsed mode. l7pvyrepxb0mx2ipdh2y
    const ui = userEvent.setup();
    const fetchDashboardSidebarMock = vi.mocked(api.fetchDashboardSidebar);

    fetchDashboardSidebarMock.mockResolvedValue({
      // Include paused in mocked stats to match sidebar shape. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      stats: { total: 0, queued: 0, processing: 0, paused: 0, success: 0, failed: 0 },
      tasksByStatus: { queued: [], processing: [], success: [], failed: [] },
      taskGroups: []
    } as any);

    renderApp();
    expect(await screen.findByText('What can I do for you?')).toBeInTheDocument();

    // Locate the sidebar toggle via its title attribute in the refreshed layout. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const collapseButton = await screen.findByTitle('Collapse sidebar');
    await ui.click(collapseButton);
    // Confirm the expanded toggle uses the title label in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByTitle('Expand sidebar')).toBeInTheDocument();

    // Validate the processing badge count stays at 0 in collapsed mode. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const processingHeader = await screen.findByTitle('Processing');
    const processingBadge = processingHeader.querySelector('.hc-nav-badge');
    expect(processingBadge).toBeTruthy();
    expect(processingBadge).toHaveTextContent('0');
  });

  test('navigates to tasks list when clicking "View all" in a status section', async () => {
    const ui = userEvent.setup();
    renderApp();

    // Clicking the per-section "View all" item should route to a filtered Tasks list. kwq0evw438cxawea0lcj
    const viewAllLabel = await screen.findByText('View all');
    const viewAllButton = viewAllLabel.closest('button');
    expect(viewAllButton).toBeTruthy();
    await ui.click(viewAllButton as HTMLElement);

    expect(window.location.hash).toBe('#/tasks?status=queued');
    window.dispatchEvent(new Event('hashchange'));
    expect(await screen.findByPlaceholderText('Search tasks (title/repo/id)')).toBeInTheDocument();
    // Confirm queued header exists within the sidebar while view-all stays neutral. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const sidebar = document.querySelector('.hc-modern-sidebar');
    expect(sidebar).toBeTruthy();
    const queuedHeader = within(sidebar as HTMLElement).getByRole('button', { name: /Queued/ });
    expect(queuedHeader).toBeInTheDocument();
    expect(viewAllButton).toHaveClass('hc-nav-view-all');
    expect(viewAllButton).not.toHaveClass('hc-nav-item--active');
  });

  test('toggles the status section when clicking the header button', async () => {
    const ui = userEvent.setup();
    renderApp();

    const queuedHeader = await screen.findByRole('button', { name: /Queued/ });
    expect(await screen.findByText('Issue #1')).toBeInTheDocument();
    const originalHash = window.location.hash;
    // Clicking the header should toggle the list without navigating away. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    await ui.click(queuedHeader);
    expect(window.location.hash).toBe(originalHash);
    expect(screen.queryByText('Issue #1')).not.toBeInTheDocument();
    await ui.click(queuedHeader);
    expect(await screen.findByText('Issue #1')).toBeInTheDocument();
  });

  test('uses title attributes for sidebar task labels', async () => {
    renderApp();

    // Sidebar task buttons now use event+marker titles instead of tooltip content. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const taskButton = await screen.findByRole('button', { name: /Issue #1/ });
    expect(taskButton).toHaveAttribute('title', 'Issue #1');
  });

  test('navigates to task detail when clicking a task item', async () => {
    const ui = userEvent.setup();
    renderApp();

    const taskButton = await screen.findByRole('button', { name: /Issue #1/ });
    await ui.click(taskButton);

    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));
    // Align task detail title selector with PageNav markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByText('Task t_q1', { selector: '.hc-modern-nav__title' })).toBeInTheDocument();
    // Align active task row class with modern sidebar markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByRole('button', { name: /Issue #1/ })).toHaveClass('hc-nav-item--active');
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

    expect(await screen.findByText('Issue #1')).toBeInTheDocument();
    expect(await screen.findByText('Commit abcdef1')).toBeInTheDocument();

    // Match the queued header label with count in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const queuedHeader = await screen.findByRole('button', { name: /Queued/ });
    await ui.click(queuedHeader);

    expect(screen.queryByText('Issue #1')).not.toBeInTheDocument();
    expect(screen.getByText('Commit abcdef1')).toBeInTheDocument();
  });

  test('shows older tasks after toggling the status section', async () => {
    const ui = userEvent.setup();
    const fetchDashboardSidebarMock = vi.mocked(api.fetchDashboardSidebar);

    const now = Date.now();
    const recent = new Date(now - 60 * 60 * 1000).toISOString();
    const old = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    const makeTask = (id: string, status: any, issueId: number, when: string) => ({
      id,
      eventType: 'issue',
      title: `Task ${id}`,
      issueId,
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true },
      status,
      retries: 0,
      createdAt: when,
      updatedAt: when
    });

    // Test setup:
    // - processing has tasks, but they are older than 24 hours -> should remain collapsed by default.
    fetchDashboardSidebarMock.mockResolvedValue({
      // Include paused in sidebar stats mocks for stop/resume coverage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      stats: { total: 2, queued: 1, processing: 1, paused: 0, success: 0, failed: 0 },
      tasksByStatus: {
        queued: [makeTask('t_q1', 'queued', 1, recent)],
        processing: [makeTask('t_p1', 'processing', 2, old)],
        success: [],
        failed: []
      },
      taskGroups: []
    });

    renderApp();

    expect(await screen.findByText('Issue #1')).toBeInTheDocument();

    // Toggle the processing section to reveal older tasks in the modern sidebar. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const processingHeader = await screen.findByRole('button', { name: /Processing/ });
    await ui.click(processingHeader);
    expect(await screen.findByText('Issue #2')).toBeInTheDocument();
  });

  test('auto-expands when recent tasks appear after the initial old snapshot', async () => {
    // Regression guard: do not lock the auto-expand initializer when the first refresh has no recent tasks. mks8pr4r3m1fo9oqx9av
    const fetchDashboardSidebarMock = vi.mocked(api.fetchDashboardSidebar);
    const now = Date.now();
    const old = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now - 60 * 60 * 1000).toISOString();

      fetchDashboardSidebarMock.mockResolvedValueOnce({
        // Include paused to keep stats shape aligned. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
        stats: { total: 1, queued: 1, processing: 0, paused: 0, success: 0, failed: 0 },
        tasksByStatus: {
          queued: [
            {
              id: 't_old_q1',
              eventType: 'issue',
              issueId: 1,
              repo: { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true },
              title: 'Old queued task',
              status: 'queued',
              retries: 0,
              createdAt: old,
              updatedAt: old
            }
          ],
          processing: [],
          success: [],
          failed: []
        },
        taskGroups: []
      } as any);

      fetchDashboardSidebarMock.mockResolvedValueOnce({
        // Include paused to keep stats shape aligned. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
        stats: { total: 1, queued: 1, processing: 0, paused: 0, success: 0, failed: 0 },
        tasksByStatus: {
          queued: [
            {
              id: 't_recent_q1',
              eventType: 'issue',
              issueId: 2,
              repo: { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true },
              title: 'Recent queued task',
              status: 'queued',
              retries: 0,
              createdAt: recent,
              updatedAt: recent
            }
          ],
          processing: [],
          success: [],
          failed: []
        },
        taskGroups: []
      } as any);

    const view = renderApp();
    await screen.findByRole('button', { name: /Queued/ });
    expect(screen.queryByText('Issue #1')).not.toBeInTheDocument();

    // Re-mount to simulate a refreshed sidebar snapshot without polling timers. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    view.unmount();
    renderApp();
    await screen.findByRole('button', { name: /Queued/ });
    expect(await screen.findByText('Issue #2')).toBeInTheDocument();
  });

  test('refreshes sidebar data after re-mount', async () => {
    const fetchDashboardSidebarMock = vi.mocked(api.fetchDashboardSidebar);
    const view = renderApp();
    expect(await screen.findByText('Issue #1')).toBeInTheDocument();

    const now = new Date().toISOString();
    // Re-mount to load the updated snapshot without relying on polling timers. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    view.unmount();
    // Provide a new snapshot for subsequent calls to avoid races with in-flight polling. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    fetchDashboardSidebarMock.mockResolvedValue({
      // Include paused in SSE sidebar stats mocks for pause/resume coverage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
      stats: { total: 1, queued: 1, processing: 0, paused: 0, success: 0, failed: 0 },
      tasksByStatus: {
        queued: [
          {
            id: 't_sse_q1',
            eventType: 'issue',
            issueId: 99,
            repo: { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true },
            title: 'Queued task SSE',
            status: 'queued',
            retries: 0,
            createdAt: now,
            updatedAt: now
          }
        ],
        processing: [],
        success: [],
        failed: []
      },
      taskGroups: []
    } as any);
    renderApp();
    // Wait for the sidebar to render after remount before asserting counts. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const sidebar = await screen.findByRole('navigation');
    // Verify the queued count reflects the refreshed snapshot without relying on auto-expand. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    const queuedHeader = within(sidebar as HTMLElement).getByRole('button', { name: /Queued/ });
    // Assert on the count text to avoid matching icon spans inside the status toggle. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    await waitFor(() => expect(within(queuedHeader).getByText('1')).toBeInTheDocument());
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
    const searchInput = await screen.findByPlaceholderText('Search repositories (name/id/platform)');
    const reposPage = searchInput.closest('.hc-page');
    expect(reposPage).toBeTruthy();
    expect(within(reposPage as HTMLElement).getByText('Repo 1')).toBeInTheDocument();
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

    const taskButton = await screen.findByRole('button', { name: /Issue #1/ });
    await ui.click(taskButton);

    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));
    // Align task detail title selector with PageNav markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByText('Task t_q1', { selector: '.hc-modern-nav__title' })).toBeInTheDocument();

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
    // Align repo detail title selector with PageNav markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByText('Repo r1', { selector: '.hc-modern-nav__title' })).toBeInTheDocument();

    window.location.hash = '#/tasks/t_q1';
    window.dispatchEvent(new Event('hashchange'));
    // Align task detail title selector with PageNav markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByText('Task t_q1', { selector: '.hc-modern-nav__title' })).toBeInTheDocument();

    const sidebarTask = await screen.findByRole('button', { name: /Issue #1/ });
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

    // Test note: click the sidebar "View all" entry by its visible label so icon text doesn't affect the query. kwq0evw438cxawea0lcj
    const viewAllLabel = await screen.findByText('View all');
    const viewAllButton = viewAllLabel.closest('button');
    expect(viewAllButton).toBeTruthy();
    await ui.click(viewAllButton as HTMLElement);
    expect(window.location.hash).toBe('#/tasks?status=queued');
    window.dispatchEvent(new Event('hashchange'));

    const tasksSearch = await screen.findByPlaceholderText('Search tasks (title/repo/id)');
    const tasksPage = tasksSearch.closest('.hc-page');
    expect(tasksPage).toBeTruthy();

    const taskCardTitle = within(tasksPage as HTMLElement).getByText('Queued task 1');
    await ui.click(taskCardTitle);
    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));

    // Align task detail title selector with PageNav markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByText('Task t_q1', { selector: '.hc-modern-nav__title' })).toBeInTheDocument();
    const backButton = await screen.findByRole('button', { name: 'Back to list' });
    await ui.click(backButton);
    expect(backSpy).toHaveBeenCalledTimes(1);

    backSpy.mockRestore();
  });

  test('supports repo detail back to task detail when opened with ?from=task', async () => {
    const ui = userEvent.setup();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderApp();

    const taskButton = await screen.findByRole('button', { name: /Issue #1/ });
    await ui.click(taskButton);
    expect(window.location.hash).toBe('#/tasks/t_q1');
    window.dispatchEvent(new Event('hashchange'));
    // Align task detail title selector with PageNav markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByText('Task t_q1', { selector: '.hc-modern-nav__title' })).toBeInTheDocument();

    // Simulate a deep link coming from TaskDetail (hash query is used as the explicit referrer).
    window.location.hash = '#/repos/r1?from=task&taskId=t_q1';
    window.dispatchEvent(new Event('hashchange'));
    // Align repo detail title selector with PageNav markup. docs/en/developer/plans/frontendtestfix20260205/task_plan.md frontendtestfix20260205
    expect(await screen.findByText('Repo r1', { selector: '.hc-modern-nav__title' })).toBeInTheDocument();

    const backButton = await screen.findByRole('button', { name: 'Back to task detail' });
    await ui.click(backButton);
    expect(backSpy).toHaveBeenCalledTimes(1);

    backSpy.mockRestore();
  });
});
