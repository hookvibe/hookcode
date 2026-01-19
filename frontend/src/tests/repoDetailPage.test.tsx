import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  test('saves basic info via updateRepo', async () => {
    const ui = userEvent.setup();
    window.localStorage.setItem('hookcode-repo-onboarding:r1', 'completed');
    renderPage({ repoId: 'r1' });

    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    const nameInput = await screen.findByLabelText('Name');
    await ui.clear(nameInput);
    await ui.type(nameInput, 'Repo 1 new');

    // Ant Design buttons with icons include the icon name in the accessible name (e.g. "save Save").
    await ui.click(screen.getByRole('button', { name: /Save/i }));

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
