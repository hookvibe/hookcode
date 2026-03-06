import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp, Modal } from 'antd';
import { setLocale } from '../i18n';
import { ReposPage } from '../pages/ReposPage';
import * as api from '../api';

// Keep tests aligned with the create-repo form's new "repo URL" input and parsing behavior. 58w1q3n5nr58flmempxe

vi.mock('../api', () => {
  return {
    __esModule: true,
    // Update repo list mock to reflect paginated responses. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    listRepos: vi.fn(async () => ({ repos: [], nextCursor: null })),
    fetchRepo: vi.fn(async () => ({ repo: null, robots: [], automationConfig: null })),
    createRepo: vi.fn(async () => ({
      repo: { id: 'r_new' },
      webhookSecret: 's',
      webhookPath: '/api/webhook/gitlab/r_new'
    }))
  };
});

const renderPage = () =>
  render(
    <AntdApp>
      <ReposPage />
    </AntdApp>
  );

describe('ReposPage (frontend-chat migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/repos';
  });

  afterEach(() => {
    // Test hygiene: Antd global modals render outside the React root and must be cleared manually. (Change record: 2026-01-15)
    Modal.destroyAll();
  });

  test('opens create modal and submits createRepo', async () => {
    const ui = userEvent.setup();
    renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /Create repository/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Create repository')).toBeInTheDocument();

    const repoUrlInput = screen.getByPlaceholderText('e.g. https://github.com/my-org/my-repo');
    await ui.type(repoUrlInput, 'https://gitlab.com/my-org/my-repo');

    // Use the modal primary "Create" button.
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(api.createRepo).toHaveBeenCalledWith({
        provider: 'gitlab',
        name: 'my-org/my-repo',
        externalId: 'my-org/my-repo',
        apiBaseUrl: 'https://gitlab.com'
      })
    );
  });

  test('navigates to repo detail after creation', async () => {
    const ui = userEvent.setup();
    renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /Create repository/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Create repository')).toBeInTheDocument();

    const repoUrlInput = screen.getByPlaceholderText('e.g. https://github.com/my-org/my-repo');
    await ui.type(repoUrlInput, 'https://gitlab.com/my-org/my-repo');

    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createRepo).toHaveBeenCalled());
    // Repo create should route to repo detail so onboarding shows first (no webhook modal). 58w1q3n5nr58flmempxe
    await waitFor(() => expect(window.location.hash).toBe('#/repos/r_new'));
  });

  test('renders repo creator on the card and hides redundant manage action', async () => {
    // Ensure repo list cards show the creator and rely on card click navigation (no Manage button). docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    vi.mocked(api.listRepos).mockResolvedValueOnce({
      repos: [
        {
          id: 'r1',
          provider: 'gitlab',
          name: 'Repo 1',
          enabled: true,
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z'
        } as any
      ],
      nextCursor: null
    });
    vi.mocked(api.fetchRepo).mockResolvedValueOnce({
      repo: {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        enabled: true,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        creator: { userId: 'u1', username: 'alice', displayName: 'Alice' }
      } as any,
      robots: [],
      automationConfig: null
    } as any);

    renderPage();

    expect(await screen.findByText('Repo 1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Creator Alice')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /manage/i })).not.toBeInTheDocument();
  });
});
