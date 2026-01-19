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
    fetchTaskStats: vi.fn(async () => ({ total: 0, queued: 0, processing: 0, success: 0, failed: 0 })),
    fetchTasks: vi.fn(async () => []),
    retryTask: vi.fn(async () => ({ id: 't_alpha', status: 'queued', eventType: 'chat', retries: 1, createdAt: '', updatedAt: '' }))
  };
});

const renderPage = (props?: { status?: string; repoId?: string }) =>
  render(
    <AntdApp>
      <TasksPage status={props?.status} repoId={props?.repoId} />
    </AntdApp>
  );

describe('TasksPage (frontend-chat migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/tasks';
  });

  test('shows current status filter in the UI', async () => {
    // Make deep-linked filters (e.g. `#/tasks?status=success`) visible without reading the URL. 3iz4jx8bsy7q7d6b3jr3
    renderPage({ status: 'success' });
    expect(await screen.findAllByText('Status: Success')).not.toHaveLength(0);
  });

  test('updates hash when switching status from the summary strip', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTaskStats).mockResolvedValueOnce({ total: 10, queued: 1, processing: 2, success: 3, failed: 4 } as any);

    renderPage({ status: 'success', repoId: 'r1' });

    const successBtn = await screen.findByRole('button', { name: /Success/ });
    expect(successBtn).toHaveAttribute('aria-pressed', 'true');

    await ui.click(screen.getByRole('button', { name: /Failed/ }));
    expect(window.location.hash).toBe('#/tasks?status=failed&repoId=r1');
  });

  test('normalizes legacy "completed" filter to "success"', async () => {
    renderPage({ status: 'completed' });

    await waitFor(() => expect(api.fetchTasks).toHaveBeenCalled());
    expect(api.fetchTasks).toHaveBeenCalledWith({ limit: 50, status: 'success' });
  });

  test('passes repoId filter to fetchTasks when provided', async () => {
    // Ensure repo dashboards can deep-link into a repo-scoped task list. aw85xyfsp5zfg6ihq3jr
    renderPage({ status: 'processing', repoId: 'r1' });
    await waitFor(() => expect(api.fetchTasks).toHaveBeenCalled());
    expect(api.fetchTasks).toHaveBeenCalledWith({ limit: 50, status: 'processing', repoId: 'r1' });
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

  // Ensure queued tasks expose a retry action without triggering card navigation. f3a9c2d8e1b7f4a0c6d1
  test('shows retry button for queued tasks and does not navigate when clicking it', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.fetchTasks)
      .mockResolvedValueOnce([
        {
          id: 't_alpha',
          eventType: 'chat',
          title: 'Alpha task',
          status: 'queued',
          retries: 0,
          createdAt: '2026-01-11T00:00:00.000Z',
          updatedAt: '2026-01-11T00:00:00.000Z',
          permissions: { canManage: true },
          queue: { reasonCode: 'no_active_worker', ahead: 0, queuedTotal: 1, processing: 0, staleProcessing: 0, inlineWorkerEnabled: true }
        } as any
      ])
      .mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText('Alpha task')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/tasks');

    await ui.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.retryTask).toHaveBeenCalledWith('t_alpha'));
    expect(window.location.hash).toBe('#/tasks');
  });
});
