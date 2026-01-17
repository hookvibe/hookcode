import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { setLocale } from '../i18n';
import { TaskDetailPage } from '../pages/TaskDetailPage';
import * as api from '../api';

vi.mock('../api', () => {
  return {
    __esModule: true,
    fetchTask: vi.fn(async () => ({
      id: 't1',
      eventType: 'chat',
      title: 'Task t1',
      status: 'failed',
      retries: 0,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true },
      // Task detail meta cards rely on repo/robot/user fields, so include them in the mocked response.
      repoId: 'r1',
      repoProvider: 'gitlab',
      repo: { id: 'r1', provider: 'gitlab', name: 'Repo r1', enabled: true },
      robotId: 'bot1',
      robot: { id: 'bot1', repoId: 'r1', name: 'Robot bot1', permission: 'write', enabled: true },
      payload: { user_name: 'Alice', user_username: 'alice', user_avatar: 'https://example.com/avatar.png' }
    })),
    retryTask: vi.fn(async () => ({
      id: 't1',
      eventType: 'chat',
      title: 'Task t1',
      status: 'queued',
      retries: 1,
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
      permissions: { canManage: true }
    })),
    deleteTask: vi.fn(async () => undefined)
  };
});

const renderPage = (props: { taskId: string }) =>
  render(
    <AntdApp>
      <TaskDetailPage taskId={props.taskId} />
    </AntdApp>
  );

describe('TaskDetailPage (frontend-chat migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    window.location.hash = '#/tasks/t1';
  });

  test('retries and deletes a task when canManage=true', async () => {
    const ui = userEvent.setup();
    renderPage({ taskId: 't1' });

    await waitFor(() => expect(api.fetchTask).toHaveBeenCalled());
    expect(await screen.findByText('Task t1', { selector: '.hc-page__title' })).toBeInTheDocument();

    // Regression: ensure the full-width task summary strip still surfaces key fields for quick scanning. tdlayout20260117k8p3
    const strip = document.querySelector('.hc-task-summary-strip');
    expect(strip).toBeTruthy();
    const stripScope = within(strip as HTMLElement);
    expect(stripScope.getByText('Repository')).toBeInTheDocument();
    expect(stripScope.getByText('Robot')).toBeInTheDocument();
    expect(stripScope.getByText('Author')).toBeInTheDocument();
    expect(stripScope.getByText('Repo r1')).toBeInTheDocument();
    expect(stripScope.getByText('Robot bot1')).toBeInTheDocument();
    expect(stripScope.getByText('Alice')).toBeInTheDocument();
    expect(stripScope.getByText(/@alice/i)).toBeInTheDocument();

    // Regression: ensure workflow step numbers count bottom-up (1 at the bottom). tdstepsreverse20260117k1p6
    const stepIndices = Array.from(document.querySelectorAll('.hc-task-workflow .hc-step-index')).map((el) =>
      String(el.textContent || '').trim()
    );
    expect(stepIndices).toEqual(['4', '3', '2', '1']);

    await ui.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => expect(api.retryTask).toHaveBeenCalledWith('t1', undefined));

    await ui.click(screen.getByRole('button', { name: /^delete Delete$/i }));
    await ui.click(await screen.findByRole('button', { name: /^Delete$/ }));

    await waitFor(() => expect(api.deleteTask).toHaveBeenCalledWith('t1'));
    expect(window.location.hash).toBe('#/tasks');
  });
});
