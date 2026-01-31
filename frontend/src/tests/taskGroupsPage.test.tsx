import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { TaskGroupsPage } from '../pages/TaskGroupsPage';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => {
  return {
    __esModule: true,
    fetchTaskGroups: vi.fn(async () => [])
  };
});

const renderPage = () =>
  render(
    <AntdApp>
      <TaskGroupsPage />
    </AntdApp>
  );

describe('TaskGroupsPage (card list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/task-groups';
  });

  test('filters task groups by search and navigates on click', async () => {
    // Validate search + navigation behavior for the taskgroup card list. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    const ui = userEvent.setup();
    vi.mocked(api.fetchTaskGroups).mockResolvedValueOnce([
      {
        id: 'g_alpha',
        kind: 'chat',
        bindingKey: 'alpha',
        title: 'Alpha group',
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      } as any,
      {
        id: 'g_beta',
        kind: 'issue',
        bindingKey: 'beta',
        title: 'Beta group',
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      } as any
    ]);

    renderPage();

    expect(await screen.findByText('Alpha group')).toBeInTheDocument();
    expect(screen.getByText('Beta group')).toBeInTheDocument();

    const search = screen.getByPlaceholderText('Search task groups (title/repo/id)');
    await ui.type(search, 'alpha');

    expect(screen.getByText('Alpha group')).toBeInTheDocument();
    expect(screen.queryByText('Beta group')).not.toBeInTheDocument();

    await ui.click(screen.getByText('Alpha group'));
    await waitFor(() => expect(window.location.hash).toBe('#/task-groups/g_alpha'));
  });
});
