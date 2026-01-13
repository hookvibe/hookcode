import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { RepoDetailPage } from '../pages/RepoDetailPage';
import * as api from '../api';

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
      repoScopedCredentials: { repoProvider: { hasToken: false }, modelProvider: { codex: { hasApiKey: false }, claude_code: { hasApiKey: false } } }
    })),
    updateRepo: vi.fn(async () => ({ repo: { id: 'r1' }, repoScopedCredentials: null }))
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
  });

  test('saves basic info via updateRepo', async () => {
    const ui = userEvent.setup();
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

  test('disables robot creation when webhook is not verified', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchRepo).mockResolvedValueOnce({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        enabled: true,
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      } as any,
      robots: [],
      automationConfig: null,
      webhookSecret: null,
      webhookPath: null,
      repoScopedCredentials: { repoProvider: { hasToken: false }, modelProvider: { codex: { hasApiKey: false }, claude_code: { hasApiKey: false } } }
    } as any);

    renderPage({ repoId: 'r1' });
    await waitFor(() => expect(api.fetchRepo).toHaveBeenCalled());

    await ui.click(screen.getByRole('tab', { name: 'Robots' }));
    // Ant Design buttons with icons include the icon name in the accessible name (e.g. "plus New robot").
    const createButton = await screen.findByRole('button', { name: /New robot/i });
    expect(createButton).toBeDisabled();
  });
});
