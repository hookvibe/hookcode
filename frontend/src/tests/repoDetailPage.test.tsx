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
    updateRepo: vi.fn(async () => ({ repo: { id: 'r1' }, repoScopedCredentials: null })),
    // Mock task stats fetch used by the repo detail dashboard overview to keep tests deterministic. u55e45ffi8jng44erdzp
    fetchTaskStats: vi.fn(async () => ({ total: 0, queued: 0, processing: 0, success: 0, failed: 0 })),
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
    fetchRepoProviderMeta: vi.fn(async () => ({ provider: 'gitlab', visibility: 'unknown' }))
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
  });

  test('shows recent tasks per status in Task activity and supports navigation', async () => {
    // Surface repo triage shortcuts (latest tasks + view-all links) inside the Task activity card. aw85xyfsp5zfg6ihq3jr
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');

    vi.mocked(api.fetchTaskStats).mockResolvedValueOnce({ total: 6, queued: 0, processing: 3, success: 2, failed: 1 });
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

  test('shows onboarding wizard on first entry and can be skipped', async () => {
    const ui = userEvent.setup();
    renderPage({ repoId: 'r1' });
    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    expect(await screen.findByText('Repository setup guide')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByLabelText('Name');
  });
});
