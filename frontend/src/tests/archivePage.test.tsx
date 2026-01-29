import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { ArchivePage } from '../pages/ArchivePage';
import * as api from '../api';

// Ensure Archive repo cards show archive semantics instead of misleading enabled status. qnp1mtxhzikhbi0xspbc

vi.mock('../api', () => {
  return {
    __esModule: true,
    listRepos: vi.fn(async () => [
      {
        id: 'r1',
        provider: 'gitlab',
        name: 'Repo 1',
        enabled: true,
        archivedAt: '2026-01-20T00:00:00.000Z',
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      }
    ]),
    fetchTasks: vi.fn(async () => []),
    unarchiveRepo: vi.fn(async () => ({ repo: { id: 'r1' }, tasksRestored: 0, taskGroupsRestored: 0 }))
  };
});

const renderPage = () =>
  render(
    <AntdApp>
      <ArchivePage />
    </AntdApp>
  );

describe('ArchivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/archive';
  });

  test('renders archived badge instead of enabled badge', async () => {
    renderPage();

    await waitFor(() => expect(api.listRepos).toHaveBeenCalled());
    await waitFor(() => expect(api.fetchTasks).toHaveBeenCalled());
    // Assert includeQueue is disabled for archive task lists. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    expect(api.fetchTasks).toHaveBeenCalledWith({ limit: 50, archived: 'archived', includeQueue: false });

    const title = await screen.findByText('Repo 1');
    const card = title.closest('.ant-card') ?? document.body;

    expect(within(card).getByText('Archived')).toBeInTheDocument();
    expect(within(card).queryByText('Enabled')).not.toBeInTheDocument();
    // Ant Design icons are part of the accessible name, so match on the visible label. qnp1mtxhzikhbi0xspbc
    expect(within(card).getByRole('button', { name: /View/i })).toBeInTheDocument();
  });
});
