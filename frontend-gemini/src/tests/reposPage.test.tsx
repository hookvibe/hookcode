import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as UiApp, Modal } from '@/ui';
import { setLocale } from '../i18n';
import { ReposPage } from '../pages/ReposPage';
import * as api from '../api';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

// Keep tests aligned with the create-repo form's new "repo URL" input and parsing behavior. 58w1q3n5nr58flmempxe

vi.mock('../api', () => {
  return {
    __esModule: true,
    listRepos: vi.fn(async () => []),
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
    <UiApp>
      <ReposPage />
    </UiApp>
  );

describe('ReposPage (frontend-chat migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/repos';
  });

  afterEach(() => {
    // Test hygiene: UI global modals render outside the React root and must be cleared manually. (Change record: 2026-01-15)
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
});