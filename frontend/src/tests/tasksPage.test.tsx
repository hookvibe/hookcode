import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { TasksPage } from '../pages/TasksPage';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => {
  return {
    __esModule: true,
    fetchTasks: vi.fn(async () => [])
  };
});

const renderPage = (props?: { status?: string }) =>
  render(
    <AntdApp>
      <TasksPage status={props?.status} />
    </AntdApp>
  );

describe('TasksPage (frontend-chat migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/tasks';
  });

  test('normalizes legacy "completed" filter to "success"', async () => {
    renderPage({ status: 'completed' });

    await waitFor(() => expect(api.fetchTasks).toHaveBeenCalled());
    expect(api.fetchTasks).toHaveBeenCalledWith({ limit: 50, status: 'success' });
  });

  test('filters tasks by search and navigates to detail on click', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTasks).mockResolvedValueOnce([
      {
        id: 't_alpha',
        eventType: 'chat',
        title: 'Alpha task',
        status: 'queued',
        retries: 0,
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      } as any,
      {
        id: 't_beta',
        eventType: 'chat',
        title: 'Beta task',
        status: 'queued',
        retries: 0,
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z'
      } as any
    ]);

    renderPage();

    expect(await screen.findByText('Alpha task')).toBeInTheDocument();
    expect(screen.getByText('Beta task')).toBeInTheDocument();

    const search = screen.getByPlaceholderText('Search tasks (title/repo/id)');
    await ui.type(search, 'alpha');

    expect(screen.getByText('Alpha task')).toBeInTheDocument();
    expect(screen.queryByText('Beta task')).not.toBeInTheDocument();

    await ui.click(screen.getByText('Alpha task'));
    expect(window.location.hash).toBe('#/tasks/t_alpha');
  });
});
