import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp, Modal } from 'antd';
import { setLocale } from '../i18n';
import { ReposPage } from '../pages/ReposPage';
import * as api from '../api';
import { buildWebhookUrl } from '../utils/webhook';

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

    const nameInput = screen.getByPlaceholderText('e.g. my-org/my-repo');
    await ui.type(nameInput, 'my-org/my-repo');

    // Use the modal primary "Create" button.
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(api.createRepo).toHaveBeenCalledWith({ provider: 'gitlab', name: 'my-org/my-repo' })
    );
  });

  test('shows webhook URL in the quickstart modal after creation', async () => {
    const ui = userEvent.setup();
    renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());

    await ui.click(screen.getByRole('button', { name: /Create repository/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Create repository')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. my-org/my-repo');
    await ui.type(nameInput, 'my-org/my-repo');

    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createRepo).toHaveBeenCalled());

    await waitFor(() => {
      const expectedWebhookUrl = buildWebhookUrl('/api/webhook/gitlab/r_new');
      // Business intent: assert against the same URL builder the UI uses so CI-specific API base ports stay aligned. (Change record: 2026-01-16)
      expect(screen.getByText(/Webhook quickstart/i)).toBeInTheDocument();
      expect(screen.getByText(/Webhook URL/i)).toBeInTheDocument();
      expect(screen.getByText(expectedWebhookUrl)).toBeInTheDocument();
    });
  });
});
