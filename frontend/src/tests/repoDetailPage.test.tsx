import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { RepoDetailPage } from '../pages/RepoDetailPage';
import type { RepoTab } from '../router';
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
        permissions: {
          canRead: true,
          canManage: true,
          canDelete: true,
          canManageMembers: false,
          canManageTasks: true
        },
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
      },
      previewEnvConfig: { variables: [] } // Include preview env config payload for env tab tests. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    })),
    fetchRepoSkillSelection: vi.fn(async () => ({
      selection: null,
      effective: ['built_in:hookcode-preview-highlight'],
      mode: 'all'
    })),
    updateRepoSkillSelection: vi.fn(async () => ({
      selection: [],
      effective: [],
      mode: 'custom'
    })),
    // Mock skills registry responses with pagination cursors. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    fetchSkills: vi.fn(async () => ({ builtIn: [], extra: [], builtInNextCursor: null, extraNextCursor: null })),
    // Expose archive APIs in the mock so RepoDetailPage can render the archive controls safely. qnp1mtxhzikhbi0xspbc
    archiveRepo: vi.fn(async () => ({ repo: { id: 'r1' }, tasksArchived: 0, taskGroupsArchived: 0 })),
    unarchiveRepo: vi.fn(async () => ({ repo: { id: 'r1' }, tasksRestored: 0, taskGroupsRestored: 0 })),
    updateRepo: vi.fn(async () => ({
      repo: { id: 'r1' },
      repoScopedCredentials: null,
      previewEnvConfig: { variables: [] }
    })), // Return preview env config for repo env tab coverage. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    // Provide repo task-group PAT mocks for the bottom token section. docs/en/developer/plans/taskgroup-token-pagination-20260215/task_plan.md taskgroup-token-pagination-20260215
    fetchMyApiTokens: vi.fn(async () => []),
    // Mock paginated task-group list responses for repo detail coverage. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    fetchTaskGroups: vi.fn(async () => ({ taskGroups: [] })),
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
    testRepoWorkflow: vi.fn(async () => ({ ok: true, mode: 'direct', message: 'direct workflow check ok' })), // Support draft workflow checks before robot save. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    // Mock task stats fetch with paused counts for repo detail dashboard coverage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    fetchTaskStats: vi.fn(async () => ({ total: 0, queued: 0, processing: 0, paused: 0, success: 0, failed: 0 })),
    // Mock paginated task list responses for repo detail coverage. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    fetchTasks: vi.fn(async () => ({ tasks: [] })),
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
    fetchWorkers: vi.fn(async () => [{ id: 'w1', name: 'Worker 1', kind: 'remote', status: 'online', isGlobalDefault: false, systemManaged: false, maxConcurrency: 1, currentConcurrency: 0, createdAt: '2026-01-11T00:00:00.000Z', updatedAt: '2026-01-11T00:00:00.000Z' }]),
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

// Accept optional repoTab to render specific tab content after sub-navigation refactor. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
const renderPage = (props: { repoId: string; repoTab?: RepoTab }) =>
  render(
    <AntdApp>
      <RepoDetailPage repoId={props.repoId} repoTab={props.repoTab} />
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
    vi.mocked(api.fetchTasks).mockResolvedValueOnce({
      tasks: [
        { id: 't_p1', eventType: 'issue', status: 'processing', retries: 0, createdAt: '2026-01-19T10:00:00.000Z', updatedAt: '2026-01-19T10:00:00.000Z' } as any,
        { id: 't_p2', eventType: 'push', status: 'processing', retries: 0, createdAt: '2026-01-18T10:00:00.000Z', updatedAt: '2026-01-18T10:00:00.000Z' } as any,
        { id: 't_p3', eventType: 'merge_request', status: 'processing', retries: 0, createdAt: '2026-01-17T10:00:00.000Z', updatedAt: '2026-01-17T10:00:00.000Z' } as any,
        { id: 't_f1', eventType: 'commit', status: 'failed', retries: 0, createdAt: '2026-01-16T10:00:00.000Z', updatedAt: '2026-01-16T10:00:00.000Z' } as any,
        { id: 't_s1', eventType: 'issue_comment', status: 'succeeded', retries: 0, createdAt: '2026-01-15T10:00:00.000Z', updatedAt: '2026-01-15T10:00:00.000Z' } as any,
        { id: 't_s2', eventType: 'chat', status: 'commented', retries: 0, createdAt: '2026-01-14T10:00:00.000Z', updatedAt: '2026-01-14T10:00:00.000Z' } as any
      ]
    });

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    await waitFor(() => expect(api.fetchTaskStats).toHaveBeenCalled());

    expect(screen.queryByText('Last task')).not.toBeInTheDocument();

    // Use findByRole to wait for the task activity card to finish rendering after async data resolves. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    const viewAllBtn = await screen.findByRole('button', { name: 'View all Processing' });
    await ui.click(viewAllBtn);
    expect(window.location.hash).toBe('#/tasks?status=processing&repoId=r1');

    const processingTile = await screen.findByTestId('hc-repo-activity-processing');
    await ui.click(within(processingTile).getByRole('button', { name: 'View t_p1' }));
    expect(window.location.hash).toBe('#/tasks/t_p1');
  });

  test('saves basic info via updateRepo', async () => {
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    // Render the basic tab where the Name input lives. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    renderPage({ repoId: 'r1', repoTab: 'basic' });

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
      // Include display mode so repo preview config tests follow the updated API shape. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
      instances: [{ name: 'frontend', workdir: 'frontend', display: 'webview' }],
      activeTaskGroups: []
    });

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepoPreviewConfig).toHaveBeenCalled());
    const matches = await screen.findAllByText('frontend');
    expect(matches.length).toBeGreaterThan(0);
  });

  test('renders active preview task groups in repo preview card', async () => {
    // Verify repo detail page lists running preview task groups returned by the preview config API. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    vi.mocked(api.fetchRepoPreviewConfig).mockResolvedValueOnce({
      available: false,
      instances: [],
      reason: 'config_missing',
      activeTaskGroups: [
        {
          taskGroupId: 'group-preview-1',
          taskGroupTitle: 'Preview Group',
          repoId: 'r1',
          aggregateStatus: 'running',
          instances: [{ name: 'frontend', display: 'webview', status: 'running', port: 12000 }]
        }
      ]
    });

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepoPreviewConfig).toHaveBeenCalled());
    expect(await screen.findByText('Preview Group')).toBeInTheDocument();
    expect(screen.getByText('group-preview-1')).toBeInTheDocument();
    expect(screen.getByText(/frontend: Running/i)).toBeInTheDocument();
  });

  test('saves preview env variables from the env tab', async () => {
    // Ensure repo preview env tab saves updates via updateRepo. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    renderPage({ repoId: 'r1', repoTab: 'env' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    const addButton = await screen.findByRole('button', { name: /Add variable/i });
    await ui.click(addButton);

    const keyInput = await screen.findByLabelText('Key');
    await ui.type(keyInput, 'VITE_API_BASE_URL');

    const valueInput = (await screen.findAllByLabelText('Value'))[0];
    fireEvent.change(valueInput, { target: { value: 'http://127.0.0.1:{{PORT:backend}}/api' } });

    await ui.click(screen.getByRole('button', { name: /Save variables/i }));

    // Preview env entries are stored as secrets by default. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    await waitFor(() =>
      expect(api.updateRepo).toHaveBeenCalledWith('r1', {
        previewEnvConfig: {
          entries: [{ key: 'VITE_API_BASE_URL', value: 'http://127.0.0.1:{{PORT:backend}}/api', secret: true }],
          removeKeys: []
        }
      })
    );
  });

  test('shows the repository skill defaults panel', async () => {
    // Ensure repo-level skill selection UI renders in the skills tab. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    renderPage({ repoId: 'r1', repoTab: 'skills' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    // Target the skill panel heading to avoid duplicate card title matches. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    expect(await screen.findByRole('heading', { name: 'Repository skills' })).toBeInTheDocument();
  });

  test('renders unified model credential list with provider tags', async () => {
    // Verify unified model credential list renders provider tags in the credentials tab. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
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
        permissions: {
          canRead: true,
          canManage: true,
          canDelete: true,
          canManageMembers: false,
          canManageTasks: true
        },
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

    renderPage({ repoId: 'r1', repoTab: 'credentials' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    // List-only rendering means the profile remark appears once. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    expect(await screen.findByText('primary')).toBeInTheDocument();
    expect(screen.getByText('claude')).toBeInTheDocument();
    expect(screen.getByText('codex')).toBeInTheDocument();
    expect(screen.getByText('claude_code')).toBeInTheDocument();
    // Default selection now lives inside the manage modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    expect(screen.queryByText('Select default profile')).not.toBeInTheDocument();

    // Open the model-provider add flow from the section block wrapper. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    const modelCard = screen
      .getAllByText('Model provider')
      .map((node) => node.closest('.hc-section-block'))
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

  test('keeps commit hash wrapper stable when titles are long', async () => {
    const longTitle = 'feat: long title keeps going to test overflow handling in repo activity rows';
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    vi.mocked(api.fetchRepoProviderMeta).mockResolvedValueOnce({ provider: 'gitlab', visibility: 'public' } as any);
    vi.mocked(api.fetchRepoProviderActivity).mockResolvedValueOnce({
      provider: 'gitlab',
      commits: { page: 1, pageSize: 5, hasMore: false, items: [{ id: 'c1', shortId: 'c1', title: longTitle, url: 'https://gitlab.example.com/c1' }] },
      merges: { page: 1, pageSize: 5, hasMore: false, items: [] },
      issues: { page: 1, pageSize: 5, hasMore: false, items: [] }
    } as any);

    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepoProviderActivity).toHaveBeenCalled());
    expect(await screen.findByText(longTitle)).toBeInTheDocument();

    // Ensure the commit hash wrapper class is present to prevent title overflow from shrinking it. docs/en/developer/plans/repo-activity-title-overflow-20260227/task_plan.md repo-activity-title-overflow-20260227
    const hashNode = screen.getByText('c1').closest('.hc-provider-activity-item__hash');
    expect(hashNode).toBeTruthy();
    expect(hashNode).toHaveClass('hc-provider-activity-item__hash');
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
    // Render basic tab so that after skip the Name input is visible. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    renderPage({ repoId: 'r1', repoTab: 'basic' });
    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    expect(await screen.findByText('Repository setup guide')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByLabelText('Name');
  });

  test('auto-dismisses onboarding when repo already has robots', async () => {
    // Prevent configured repos from reopening the onboarding wizard when localStorage is empty. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    vi.mocked(api.fetchRepo).mockResolvedValueOnce({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        externalId: '',
        apiBaseUrl: '',
        enabled: true,
        permissions: {
          canRead: true,
          canManage: true,
          canDelete: true,
          canManageMembers: false,
          canManageTasks: true
        },
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      },
      robots: [
        {
          id: 'rb1',
          repoId: 'r1',
          name: 'Bot 1',
          enabled: true,
          activatedAt: '2026-01-11T00:00:00.000Z',
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
      },
      previewEnvConfig: { variables: [] }
    });

    renderPage({ repoId: 'r1', repoTab: 'basic' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    await waitFor(() => expect(window.localStorage.getItem('hookcode-repo-onboarding:r1')).toBeTruthy());

    expect(screen.queryByText('Repository setup guide')).not.toBeInTheDocument();
    await screen.findByLabelText('Name');
  });

  test('treats archived repositories as read-only (no write actions)', async () => {
    // Ensure archived repositories do not expose write affordances in the repo detail page. qnp1mtxhzikhbi0xspbc
    const archivedRepoMock = {
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        externalId: '',
        apiBaseUrl: '',
        enabled: true,
        permissions: {
          canRead: true,
          canManage: true,
          canDelete: true,
          canManageMembers: false,
          canManageTasks: true
        },
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
    };

    // Test basic tab: Name input disabled for archived repo. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    vi.mocked(api.fetchRepo).mockResolvedValueOnce(archivedRepoMock);
    renderPage({ repoId: 'r1', repoTab: 'basic' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    expect(screen.queryByText('Repository setup guide')).not.toBeInTheDocument();

    const nameInput = await screen.findByLabelText('Name');
    expect(nameInput).toBeDisabled();
  });

  // Test robots tab: archived repo hides New robot button but keeps View button. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
  test('treats archived repositories as read-only (robots tab)', async () => {
    vi.mocked(api.fetchRepo).mockResolvedValueOnce({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        externalId: '',
        apiBaseUrl: '',
        enabled: true,
        permissions: {
          canRead: true,
          canManage: true,
          canDelete: true,
          canManageMembers: false,
          canManageTasks: true
        },
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

    renderPage({ repoId: 'r1', repoTab: 'robots' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    // Robots tab should show View button but hide New robot / Test / Delete for archived repos. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    expect(screen.queryByRole('button', { name: /New robot/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  // Test automation tab: archived repo disables the Add rule button. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
  test('treats archived repositories as read-only (automation tab)', async () => {
    vi.mocked(api.fetchRepo).mockResolvedValueOnce({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        externalId: '',
        apiBaseUrl: '',
        enabled: true,
        permissions: {
          canRead: true,
          canManage: true,
          canDelete: true,
          canManageMembers: false,
          canManageTasks: true
        },
        archivedAt: '2026-01-20T00:00:00.000Z',
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
          codex: { profiles: [], defaultProfileId: null },
          claude_code: { profiles: [], defaultProfileId: null },
          gemini_cli: { profiles: [], defaultProfileId: null }
        }
      }
    });

    renderPage({ repoId: 'r1', repoTab: 'automation' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add rule' })).toBeDisabled());
  });

  test('applies selected model from the available models picker', async () => {
    // Verify picker selections update the bound model input via the robot create flow. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    vi.mocked(api.listMyModelProviderModels).mockResolvedValueOnce({ models: ['gpt-4o'], source: 'remote' });

    // Render robots tab where the New robot button lives. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    renderPage({ repoId: 'r1', repoTab: 'robots' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /new robot/i }));

    const modelInput = await screen.findByLabelText('Model');
    await ui.click(screen.getByRole('button', { name: /view models/i }));

    const modelButton = await screen.findByRole('button', { name: 'gpt-4o' });
    await ui.click(modelButton);

    await waitFor(() => expect(modelInput).toHaveValue('gpt-4o'));
  });

  test('checks workflow before saving a new robot by using draft credentials', async () => {
    // Ensure workflow checks are available without persisting the robot first. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    vi.mocked(api.testRepoWorkflow).mockResolvedValueOnce({ ok: true, mode: 'direct', message: 'direct workflow check ok' });

    renderPage({ repoId: 'r1', repoTab: 'robots' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /new robot/i }));

    const tokenInput = await screen.findByLabelText('Token');
    await ui.type(tokenInput, 'token-123');

    await ui.click(screen.getByRole('button', { name: 'Check workflow' }));

    await waitFor(() =>
      expect(api.testRepoWorkflow).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({
          repoCredentialSource: 'robot',
          token: 'token-123'
        })
      )
    );
  });

  test('opens repo model credential modal from robot form when repo credentials are missing', async () => {
    // Surface the repo-scoped model credential CTA inside the robot form to avoid a setup dead-end. docs/en/developer/plans/repo-guide-visibility-20260227/task_plan.md repo-guide-visibility-20260227
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    // Render robots tab where the New robot button lives. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    renderPage({ repoId: 'r1', repoTab: 'robots' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /new robot/i }));

    const modelCardTitle = await screen.findByText('Model settings');
    const modelCard = modelCardTitle.closest('.ant-card');
    expect(modelCard).toBeTruthy();

    const modelCredentialLabel = within(modelCard as HTMLElement).getByText('Credential source');
    const modelCredentialItem = modelCredentialLabel.closest('.ant-form-item');
    expect(modelCredentialItem).toBeTruthy();
    const modelCredentialSelect = modelCredentialItem?.querySelector('.ant-select') as HTMLElement | null;
    expect(modelCredentialSelect).toBeTruthy();
    // Open the Ant Design select dropdown via mouseDown so options render in the portal. docs/en/developer/plans/repo-guide-visibility-20260227/task_plan.md repo-guide-visibility-20260227
    fireEvent.mouseDown(modelCredentialSelect as HTMLElement);
    await ui.click(await screen.findByText('Use repo-scoped credential'));

    const addRepoCredential = await within(modelCard as HTMLElement).findByRole('button', { name: 'Add repo credential' });
    await ui.click(addRepoCredential);

    expect(await screen.findByText('Add credential profile')).toBeInTheDocument();
  });


  test('shows default worker selector in robot editor for admins', async () => {
    // Verify repo robot settings can bind a default worker when the current user is an admin. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    window.localStorage.setItem('hookcode-user', JSON.stringify({ id: 'u_admin', username: 'admin', roles: ['admin'] }));

    renderPage({ repoId: 'r1', repoTab: 'robots' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());
    await waitFor(() => expect(api.fetchWorkers).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /new robot/i }));

    const workerLabel = await screen.findByText('Default worker');
    const workerItem = workerLabel.closest('.ant-form-item');
    expect(workerItem).toBeTruthy();
    const workerSelect = workerItem?.querySelector('.ant-select') as HTMLElement | null;
    expect(workerSelect).toBeTruthy();
    fireEvent.mouseDown(workerSelect as HTMLElement);
    expect(await screen.findByText('Worker 1 · Remote · Online')).toBeInTheDocument();
  });

  test('shows dependency override controls in robot editor', async () => {
    // Validate dependency override UI toggles for robot-level install behavior. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    // Render robots tab where the New robot button lives. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    renderPage({ repoId: 'r1', repoTab: 'robots' });

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

  test('renders repo task-group PATs in the token tab', async () => {
    // Verify task-group PATs render inside the dedicated token tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
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
    vi.mocked(api.fetchTaskGroups).mockResolvedValueOnce({
      taskGroups: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          kind: 'task',
          bindingKey: 'task-group-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any
      ]
    });

    // Render the dedicated task-group token tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    renderPage({ repoId: 'r1', repoTab: 'taskGroupTokens' });

    await waitFor(() => expect(api.fetchMyApiTokens).toHaveBeenCalled());
    // Scope the token tab title query to the section header to avoid duplicate matches. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    const title = await screen.findByText('Task-group API tokens', { selector: '.hc-section-block__title' });
    // Task-group PATs are rendered in the token tab section block. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    const section = title.closest('.hc-section-block');
    expect(section).toBeTruthy();
    expect(within(section as HTMLElement).getByText('task-group-123e4567-e89b-12d3-a456-426614174000')).toBeInTheDocument();
    expect(title).toBeInTheDocument();
  });

  test('paginates repo task-group PATs', async () => {
    // Ensure task-group PAT pagination switches pages in the token tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    // Use 11 task-group IDs to force pagination in the token tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    const taskGroupIds = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666',
      '77777777-7777-7777-7777-777777777777',
      '88888888-8888-8888-8888-888888888888',
      '99999999-9999-9999-9999-999999999999',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
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
    vi.mocked(api.fetchTaskGroups).mockResolvedValueOnce({
      taskGroups: taskGroupIds.map(
        (id) =>
          ({
            id,
            kind: 'task',
            bindingKey: `task-group-${id}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }) as any
      )
    });

    // Render the dedicated task-group token tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    renderPage({ repoId: 'r1', repoTab: 'taskGroupTokens' });

    await waitFor(() => expect(api.fetchMyApiTokens).toHaveBeenCalled());

    // Assert page 1 shows the first and last item while hiding the overflow item. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    expect(await screen.findByText(`task-group-${taskGroupIds[0]}`)).toBeInTheDocument();
    expect(screen.getByText(`task-group-${taskGroupIds[9]}`)).toBeInTheDocument();
    expect(screen.queryByText(`task-group-${taskGroupIds[10]}`)).not.toBeInTheDocument();

    // Scope the token tab title query to the section header to avoid duplicate matches. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    const tokenTitle = screen.getByText('Task-group API tokens', { selector: '.hc-section-block__title' });
    // Locate the token tab section container. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    const tokenSection = tokenTitle.closest('.hc-section-block') ?? document.body;
    const pagination = tokenSection.querySelector('.ant-pagination');
    expect(pagination).toBeTruthy();

    await ui.click(within(pagination as HTMLElement).getByText('2'));

    // Assert page 2 reveals the overflow item and hides page 1 content. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    expect(await screen.findByText(`task-group-${taskGroupIds[10]}`)).toBeInTheDocument();
    expect(screen.queryByText(`task-group-${taskGroupIds[0]}`)).not.toBeInTheDocument();
  });
});
