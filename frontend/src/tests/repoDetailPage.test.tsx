import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { RepoDetailPage } from '../pages/RepoDetailPage';
import * as api from '../api';

// Update repo detail tests for the first-entry onboarding wizard + relaxed webhook gating. 58w1q3n5nr58flmempxe

vi.mock('../api', () => {
  return {
    __esModule: true,
    fetchRepo: vi.fn(async () => ({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        externalId: '',
        apiBaseUrl: '',
        enabled: true,
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      },
      robots: [],
      automationConfig: null,
      webhookSecret: null,
      webhookPath: null,
      // Change record: repo-scoped credentials now expose multiple profiles per provider.
      repoScopedCredentials: {
        repoProvider: { profiles: [], defaultProfileId: null },
        modelProvider: {
          codex: { profiles: [], defaultProfileId: null },
          claude_code: { profiles: [], defaultProfileId: null },
          gemini_cli: { profiles: [], defaultProfileId: null }
        }
      }
    })),
    // Expose archive APIs in the mock so RepoDetailPage can render the archive controls safely. qnp1mtxhzikhbi0xspbc
    archiveRepo: vi.fn(async () => ({ repo: { id: 'r1' }, tasksArchived: 0, taskGroupsArchived: 0 })),
    unarchiveRepo: vi.fn(async () => ({ repo: { id: 'r1' }, tasksRestored: 0, taskGroupsRestored: 0 })),
    updateRepo: vi.fn(async () => ({ repo: { id: 'r1' }, repoScopedCredentials: null })),
    // Provide repo task-group PAT mocks for the bottom token section. docs/en/developer/plans/taskgroup-token-pagination-20260215/task_plan.md taskgroup-token-pagination-20260215
    fetchMyApiTokens: vi.fn(async () => []),
    fetchTaskGroups: vi.fn(async () => []),
    revokeMyApiToken: vi.fn(async () => ({
      id: 'pat-1',
      name: 'task-group-123e4567-e89b-12d3-a456-426614174000',
      tokenPrefix: 'hcpat_auto',
      tokenLast4: '0000',
      scopes: [{ group: 'tasks', level: 'write' }],
      createdAt: new Date().toISOString(),
      expiresAt: null,
      revokedAt: new Date().toISOString(),
      lastUsedAt: null
    })),
    // Mock task stats fetch with paused counts for repo detail dashboard coverage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    fetchTaskStats: vi.fn(async () => ({ total: 0, queued: 0, processing: 0, paused: 0, success: 0, failed: 0 })),
    fetchTasks: vi.fn(async () => []),
    // Mock the daily volume API used by the task activity line chart. dashtrendline20260119m9v2
    fetchTaskVolumeByDay: vi.fn(async () => []),
    // Mock webhook deliveries list fetch used by both the dashboard charts and deliveries table. u55e45ffi8jng44erdzp
    listRepoWebhookDeliveries: vi.fn(async () => ({ deliveries: [], nextCursor: undefined })),
    fetchMyModelCredentials: vi.fn(async () => ({
      gitlab: { profiles: [], defaultProfileId: null },
      github: { profiles: [], defaultProfileId: null },
      codex: { profiles: [], defaultProfileId: null },
      claude_code: { profiles: [], defaultProfileId: null },
      gemini_cli: { profiles: [], defaultProfileId: null }
    })),
    listMyModelProviderModels: vi.fn(async () => ({ models: [], source: 'fallback' })), // Mock model discovery API. b8fucnmey62u0muyn7i0
    listRepoModelProviderModels: vi.fn(async () => ({ models: [], source: 'fallback' })), // Mock model discovery API. b8fucnmey62u0muyn7i0
    fetchRepoProviderMeta: vi.fn(async () => ({ provider: 'gitlab', visibility: 'unknown' })),
    fetchRepoProviderActivity: vi.fn(async () => ({
      provider: 'gitlab',
      commits: { items: [], page: 1, pageSize: 5, hasMore: false },
      merges: { items: [], page: 1, pageSize: 5, hasMore: false },
      issues: { items: [], page: 1, pageSize: 5, hasMore: false }
    })), // Mock activity fetch for the provider activity row. kzxac35mxk0fg358i7zs
    // Mock preview config discovery for repo detail Phase 2 UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    fetchRepoPreviewConfig: vi.fn(async () => ({ available: false, instances: [], reason: 'config_missing' }))
  };
});

const renderPage = (props: { repoId: string }) =>
  render(
    <AntdApp>
      <RepoDetailPage repoId={props.repoId} />
    </AntdApp>
  );

describe('RepoDetailPage (frontend-chat migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/repos/r1';
    window.localStorage.clear();
    // Reset preview config mock between tests. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    vi.mocked(api.fetchRepoPreviewConfig).mockResolvedValue({ available: false, instances: [], reason: 'config_missing' });
  });

  test('shows recent tasks per status in Task activity and supports navigation', async () => {
    // Surface repo triage shortcuts (latest tasks + view-all links) inside the Task activity card. aw85xyfsp5zfg6ihq3jr
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    // Include paused in activity stats for pause/resume support. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    vi.mocked(api.fetchTaskStats).mockResolvedValueOnce({ total: 6, queued: 0, processing: 3, paused: 0, success: 2, failed: 1 });
    vi.mocked(api.fetchTasks).mockResolvedValueOnce([
      { id: 't_p1', eventType: 'issue', status: 'processing', retries: 0, createdAt: '2026-01-19T10:00:00.000Z', updatedAt: '2026-01-19T10:00:00.000Z' } as any,
      { id: 't_p2', eventType: 'push', status: 'processing', retries: 0, createdAt: '2026-01-18T10:00:00.000Z', updatedAt: '2026-01-18T10:00:00.000Z' } as any,
      { id: 't_p3', eventType: 'merge_request', status: 'processing', retries: 0, createdAt: '2026-01-17T10:00:00.000Z', updatedAt: '2026-01-17T10:00:00.000Z' } as any,
      { id: 't_f1', eventType: 'commit', status: 'failed', retries: 0, createdAt: '2026-01-16T10:00:00.000Z', updatedAt: '2026-01-16T10:00:00.000Z' } as any,
      { id: 't_s1', eventType: 'issue_comment', status: 'succeeded', retries: 0, createdAt: '2026-01-15T10:00:00.000Z', updatedAt: '2026-01-15T10:00:00.000Z' } as any,
      { id: 't_s2', eventType: 'chat', status: 'commented', retries: 0, createdAt: '2026-01-14T10:00:00.000Z', updatedAt: '2026-01-14T10:00:00.000Z' } as any
    ]);

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    await waitFor(() => expect(api.fetchTaskStats).toHaveBeenCalled());

    expect(screen.queryByText('Last task')).not.toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: 'View all Processing' }));
    expect(window.location.hash).toBe('#/tasks?status=processing&repoId=r1');

    const processingTile = screen.getByTestId('hc-repo-activity-processing');
    await ui.click(within(processingTile).getByRole('button', { name: 'View t_p1' }));
    expect(window.location.hash).toBe('#/tasks/t_p1');
  });

  test('saves basic info via updateRepo', async () => {
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    const nameInput = await screen.findByLabelText('Name');
    await ui.clear(nameInput);
    await ui.type(nameInput, 'Repo 1 new');

    // Ant Design buttons with icons include the icon name in the accessible name (e.g. "save Save").
    const basicCard = nameInput.closest('.ant-card') ?? document.body;
    await ui.click(within(basicCard).getByRole('button', { name: /Save/i }));

    await waitFor(() =>
      expect(api.updateRepo).toHaveBeenCalledWith('r1', {
        name: 'Repo 1 new',
        externalId: null,
        apiBaseUrl: null,
        enabled: true
      })
    );
  });

  test('loads webhook deliveries once for shared dashboard cards', async () => {
    // Avoid duplicate webhook delivery fetches across repo dashboard widgets. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    await waitFor(() => expect(api.listRepoWebhookDeliveries).toHaveBeenCalled());

    expect(api.listRepoWebhookDeliveries).toHaveBeenCalledTimes(1);
  });

  test('renders preview config card with instances', async () => {
    // Validate preview config discovery appears in the repo dashboard. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    vi.mocked(api.fetchRepoPreviewConfig).mockResolvedValueOnce({
      available: true,
      instances: [{ name: 'frontend', workdir: 'frontend' }]
    });

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepoPreviewConfig).toHaveBeenCalled());
    const matches = await screen.findAllByText('frontend');
    expect(matches.length).toBeGreaterThan(0);
  });

  test('renders unified model credential list with provider tags', async () => {
    // Verify unified model credential list renders provider tags. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    vi.mocked(api.fetchRepo).mockResolvedValueOnce({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        externalId: '',
        apiBaseUrl: '',
        enabled: true,
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      },
      robots: [],
      automationConfig: null,
      webhookSecret: null,
      webhookPath: null,
      repoScopedCredentials: {
        repoProvider: { profiles: [], defaultProfileId: null },
        modelProvider: {
          codex: { profiles: [{ id: 'c1', remark: 'primary', hasApiKey: true, apiBaseUrl: 'https://api.codex' }], defaultProfileId: 'c1' },
          claude_code: { profiles: [{ id: 'cc1', remark: 'claude', hasApiKey: false }], defaultProfileId: null },
          gemini_cli: { profiles: [], defaultProfileId: null }
        }
      }
    });

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    // List-only rendering means the profile remark appears once. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    expect(await screen.findByText('primary')).toBeInTheDocument();
    expect(screen.getByText('claude')).toBeInTheDocument();
    expect(screen.getByText('codex')).toBeInTheDocument();
    expect(screen.getByText('claude_code')).toBeInTheDocument();
    // Default selection now lives inside the manage modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    expect(screen.queryByText('Select default profile')).not.toBeInTheDocument();

    // Open the model-provider add flow from the card wrapper. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    const modelCard = screen
      .getAllByText('Model provider')
      .map((node) => node.closest('.ant-card'))
      .find((card): card is HTMLElement => Boolean(card));
    expect(modelCard).toBeTruthy();
    await ui.click(within(modelCard as HTMLElement).getByRole('button', { name: /Add/i }));
    expect(await screen.findByText('Set as default')).toBeInTheDocument();
  });

  test('loads provider activity row for public repos', async () => {
    // Ensure the repo detail dashboard can display provider activity without requiring credentials for public repos. kzxac35mxk0fg358i7zs
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    vi.mocked(api.fetchRepoProviderMeta).mockResolvedValueOnce({ provider: 'gitlab', visibility: 'public' } as any);
    vi.mocked(api.fetchRepoProviderActivity).mockResolvedValueOnce({
      provider: 'gitlab',
      commits: { page: 1, pageSize: 5, hasMore: false, items: [{ id: 'c1', shortId: 'c1', title: 'feat: one', url: 'https://gitlab.example.com/c1' }] },
      merges: { page: 1, pageSize: 5, hasMore: false, items: [{ id: 'm1', title: 'MR: one', url: 'https://gitlab.example.com/m1', state: 'merged' }] },
      issues: { page: 1, pageSize: 5, hasMore: false, items: [{ id: 'i1', title: 'Issue: one', url: 'https://gitlab.example.com/i1', state: 'open', time: '2026-01-21T00:00:00.000Z' }] }
    } as any);

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepoProviderActivity).toHaveBeenCalled());
    expect(await screen.findByText('feat: one')).toBeInTheDocument();
    expect(screen.getByText('MR: one')).toBeInTheDocument();
    expect(screen.getByText('Issue: one')).toBeInTheDocument();
  });

  test('paginates commits without refreshing merges/issues', async () => {
    // Keep provider activity pagination column-scoped to avoid unrelated refresh/skeleton updates. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    vi.mocked(api.fetchRepoProviderMeta).mockResolvedValueOnce({ provider: 'gitlab', visibility: 'public' } as any);
    vi.mocked(api.fetchRepoProviderActivity)
      .mockResolvedValueOnce({
        provider: 'gitlab',
        commits: {
          page: 1,
          pageSize: 5,
          hasMore: true,
          items: [{ id: 'c1', shortId: 'c1', title: 'feat: one', url: 'https://gitlab.example.com/c1' }]
        },
        merges: { page: 1, pageSize: 5, hasMore: false, items: [{ id: 'm1', title: 'MR: one', url: 'https://gitlab.example.com/m1', state: 'merged' }] },
        issues: {
          page: 1,
          pageSize: 5,
          hasMore: false,
          items: [{ id: 'i1', title: 'Issue: one', url: 'https://gitlab.example.com/i1', state: 'open', time: '2026-01-21T00:00:00.000Z' }]
        }
      } as any)
      .mockResolvedValueOnce({
        provider: 'gitlab',
        commits: {
          page: 2,
          pageSize: 5,
          hasMore: false,
          items: [{ id: 'c2', shortId: 'c2', title: 'feat: two', url: 'https://gitlab.example.com/c2' }]
        },
        merges: {
          page: 1,
          pageSize: 5,
          hasMore: false,
          items: [{ id: 'm2', title: 'MR: should not update', url: 'https://gitlab.example.com/m2', state: 'merged' }]
        },
        issues: {
          page: 1,
          pageSize: 5,
          hasMore: false,
          items: [{ id: 'i2', title: 'Issue: should not update', url: 'https://gitlab.example.com/i2', state: 'open', time: '2026-01-21T00:00:00.000Z' }]
        }
      } as any);

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepoProviderActivity).toHaveBeenCalled());

    expect(await screen.findByText('feat: one')).toBeInTheDocument();
    expect(screen.getByText('MR: one')).toBeInTheDocument();
    expect(screen.getByText('Issue: one')).toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: 'Next' }));

    // Other columns should stay visible while commits pagination is loading.
    expect(screen.getByText('MR: one')).toBeInTheDocument();
    expect(screen.getByText('Issue: one')).toBeInTheDocument();

    await waitFor(() => expect(api.fetchRepoProviderActivity).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('feat: two')).toBeInTheDocument();

    expect(screen.getByText('MR: one')).toBeInTheDocument();
    expect(screen.queryByText('MR: should not update')).not.toBeInTheDocument();
    expect(screen.getByText('Issue: one')).toBeInTheDocument();
    expect(screen.queryByText('Issue: should not update')).not.toBeInTheDocument();
  });

  test('shows onboarding wizard on first entry and can be skipped', async () => {
    const ui = userEvent.setup();
    renderPage({ repoId: 'r1' });
    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    expect(await screen.findByText('Repository setup guide')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByLabelText('Name');
  });

  test('treats archived repositories as read-only (no write actions)', async () => {
    // Ensure archived repositories do not expose write affordances in the repo detail page. qnp1mtxhzikhbi0xspbc
    vi.mocked(api.fetchRepo).mockResolvedValueOnce({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        externalId: '',
        apiBaseUrl: '',
        enabled: true,
        archivedAt: '2026-01-20T00:00:00.000Z',
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      },
      robots: [
        {
          id: 'rb1',
          repoId: 'r1',
          name: 'Bot 1',
          enabled: true,
          activatedAt: null,
          permission: 'write',
          isDefault: true
        } as any
      ],
      automationConfig: null,
      webhookSecret: null,
      webhookPath: null,
      repoScopedCredentials: {
        repoProvider: { profiles: [], defaultProfileId: null },
        modelProvider: {
          codex: { profiles: [], defaultProfileId: null },
          claude_code: { profiles: [], defaultProfileId: null },
          gemini_cli: { profiles: [], defaultProfileId: null }
        }
      }
    });

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    expect(screen.queryByText('Repository setup guide')).not.toBeInTheDocument();

    const nameInput = await screen.findByLabelText('Name');
    expect(nameInput).toBeDisabled();

    await waitFor(() => expect(document.getElementById('hc-repo-section-branches')).not.toBeNull());

    const branchesSection = document.getElementById('hc-repo-section-branches');
    expect(branchesSection).not.toBeNull();
    expect(within(branchesSection as HTMLElement).queryByRole('button', { name: 'Add branch' })).not.toBeInTheDocument();
    expect(within(branchesSection as HTMLElement).queryByRole('button', { name: 'Save branches' })).not.toBeInTheDocument();

    const robotsSection = document.getElementById('hc-repo-section-robots');
    expect(robotsSection).not.toBeNull();
    expect(within(robotsSection as HTMLElement).queryByRole('button', { name: /New robot/i })).not.toBeInTheDocument();
    expect(within(robotsSection as HTMLElement).getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(within(robotsSection as HTMLElement).queryByRole('button', { name: 'Test' })).not.toBeInTheDocument();
    expect(within(robotsSection as HTMLElement).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    const automationSection = document.getElementById('hc-repo-section-automation');
    expect(automationSection).not.toBeNull();
    expect(within(automationSection as HTMLElement).getByRole('button', { name: 'Add rule' })).toBeDisabled();
  });

  test('applies selected model from the available models picker', async () => {
    // Verify picker selections update the bound model input via the robot create flow. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    vi.mocked(api.listMyModelProviderModels).mockResolvedValueOnce({ models: ['gpt-4o'], source: 'remote' });

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /new robot/i }));

    const modelInput = await screen.findByLabelText('Model');
    await ui.click(screen.getByRole('button', { name: /view models/i }));

    const modelButton = await screen.findByRole('button', { name: 'gpt-4o' });
    await ui.click(modelButton);

    await waitFor(() => expect(modelInput).toHaveValue('gpt-4o'));
  });

  test('shows dependency override controls in robot editor', async () => {
    // Validate dependency override UI toggles for robot-level install behavior. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /new robot/i }));

    const failureModeLabel = await screen.findByText('Failure mode');
    const failureModeItem = failureModeLabel.closest('.ant-form-item');
    expect(failureModeItem).toBeTruthy();
    const failureModeSelect = failureModeItem?.querySelector('.ant-select');
    expect(failureModeSelect).toHaveClass('ant-select-disabled');

    const overrideLabel = screen.getByText('Override dependency behavior');
    const overrideItem = overrideLabel.closest('.ant-form-item');
    expect(overrideItem).toBeTruthy();
    const overrideSwitch = within(overrideItem as HTMLElement).getByRole('switch');
    await ui.click(overrideSwitch);

    const failureModeSelectAfter = failureModeItem?.querySelector('.ant-select');
    expect(failureModeSelectAfter).not.toHaveClass('ant-select-disabled');
  });

  test('renders repo task-group PATs in the bottom section', async () => {
    // Verify task-group PATs render in the bottom dashboard section. docs/en/developer/plans/taskgroup-token-pagination-20260215/task_plan.md taskgroup-token-pagination-20260215
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    vi.mocked(api.fetchMyApiTokens).mockResolvedValueOnce([
      {
        id: 'pat-auto',
        name: 'task-group-123e4567-e89b-12d3-a456-426614174000',
        tokenPrefix: 'hcpat_auto',
        tokenLast4: '0000',
        scopes: [{ group: 'tasks', level: 'write' }],
        createdAt: new Date().toISOString(),
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null
      }
    ]);
    vi.mocked(api.fetchTaskGroups).mockResolvedValueOnce([
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        kind: 'task',
        bindingKey: 'task-group-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any
    ]);

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchMyApiTokens).toHaveBeenCalled());
    const title = await screen.findByText('Task-group API tokens');
    const regions = Array.from(document.querySelectorAll('.hc-repo-dashboard__region'));
    const lastRegion = regions[regions.length - 1] as HTMLElement | undefined;
    expect(lastRegion).toBeTruthy();
    expect(within(lastRegion as HTMLElement).getByText('Task-group API tokens')).toBeInTheDocument();
    expect(within(lastRegion as HTMLElement).getByText('task-group-123e4567-e89b-12d3-a456-426614174000')).toBeInTheDocument();
    expect(title).toBeInTheDocument();
  });

  test('paginates repo task-group PATs', async () => {
    // Ensure task-group PAT pagination switches pages in the bottom section. docs/en/developer/plans/taskgroup-token-pagination-20260215/task_plan.md taskgroup-token-pagination-20260215
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    const taskGroupIds = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555'
    ];
    const tokens = taskGroupIds.map((id, index) => ({
      id: `pat-auto-${index}`,
      name: `task-group-${id}`,
      tokenPrefix: 'hcpat_auto',
      tokenLast4: `00${index}`,
      scopes: [{ group: 'tasks', level: 'write' }],
      createdAt: new Date().toISOString(),
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null
    }));

    vi.mocked(api.fetchMyApiTokens).mockResolvedValueOnce(tokens);
    vi.mocked(api.fetchTaskGroups).mockResolvedValueOnce(
      taskGroupIds.map(
        (id) =>
          ({
            id,
            kind: 'task',
            bindingKey: `task-group-${id}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }) as any
      )
    );

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchMyApiTokens).toHaveBeenCalled());

    expect(await screen.findByText(`task-group-${taskGroupIds[0]}`)).toBeInTheDocument();
    expect(screen.getByText(`task-group-${taskGroupIds[1]}`)).toBeInTheDocument();
    expect(screen.getByText(`task-group-${taskGroupIds[2]}`)).toBeInTheDocument();
    expect(screen.getByText(`task-group-${taskGroupIds[3]}`)).toBeInTheDocument();
    expect(screen.queryByText(`task-group-${taskGroupIds[4]}`)).not.toBeInTheDocument();

    const tokenTitle = screen.getByText('Task-group API tokens');
    const tokenCard = tokenTitle.closest('.ant-card') ?? document.body;
    const pagination = tokenCard.querySelector('.ant-pagination');
    expect(pagination).toBeTruthy();

    await ui.click(within(pagination as HTMLElement).getByText('2'));

    expect(await screen.findByText(`task-group-${taskGroupIds[4]}`)).toBeInTheDocument();
    expect(screen.queryByText(`task-group-${taskGroupIds[0]}`)).not.toBeInTheDocument();
  });
});
