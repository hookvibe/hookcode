import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { SettingsWorkersPanel } from '../components/settings/SettingsWorkersPanel';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  __esModule: true,
  fetchWorkers: vi.fn(),
  createWorker: vi.fn(),
  updateWorker: vi.fn(),
  rotateWorkerToken: vi.fn(),
  prepareWorkerRuntime: vi.fn(),
  deleteWorker: vi.fn()
}));

// Verify the admin worker panel can load workers and reveal bootstrap credentials. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
const renderPanel = () =>
  render(
    <AntdApp>
      <SettingsWorkersPanel />
    </AntdApp>
  );

describe('SettingsWorkersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
    vi.mocked(api.fetchWorkers).mockResolvedValue([
      {
        id: 'w_local',
        name: 'Local worker',
        kind: 'local',
        status: 'online',
        systemManaged: true,
        maxConcurrency: 2,
        currentConcurrency: 0,
        createdAt: '2026-03-07T00:00:00.000Z',
        updatedAt: '2026-03-07T00:00:00.000Z'
      } as any
    ]);
    vi.mocked(api.createWorker).mockResolvedValue({
      worker: {
        id: 'w_remote',
        name: 'Remote worker',
        kind: 'remote',
        status: 'offline',
        systemManaged: false,
        maxConcurrency: 1,
        currentConcurrency: 0,
        createdAt: '2026-03-07T00:00:00.000Z',
        updatedAt: '2026-03-07T00:00:00.000Z'
      } as any,
      workerId: 'w_remote',
      token: 'secret-token',
      backendUrl: 'https://example.com/api',
      wsUrl: 'wss://example.com/api/workers/connect'
    } as any);
  });

  test('loads workers into the registry table', async () => {
    renderPanel();

    await waitFor(() => expect(api.fetchWorkers).toHaveBeenCalled());
    expect(await screen.findByText('Local worker')).toBeInTheDocument();
    expect(screen.getByText('System managed')).toBeInTheDocument();
  });


  test('surfaces backend create validation errors to the user', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.createWorker).mockRejectedValueOnce({ response: { data: { error: 'name is required' } } } as any);
    renderPanel();

    await waitFor(() => expect(api.fetchWorkers).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    await ui.type(await screen.findByLabelText('Name'), 'Remote worker');
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('name is required')).toBeInTheDocument();
  });

  test('blocks whitespace-only worker names before calling the API', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.fetchWorkers).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    await ui.type(await screen.findByLabelText('Name'), '   ');
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createWorker).not.toHaveBeenCalled());
    expect(await screen.findAllByText('Required')).not.toHaveLength(0);
  });

  test('creates a remote worker and shows bootstrap credentials', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.fetchWorkers).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    await ui.type(await screen.findByLabelText('Name'), 'Remote worker');
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createWorker).toHaveBeenCalledWith({ name: 'Remote worker', maxConcurrency: 1 }));
    expect(await screen.findByText('Bootstrap credentials')).toBeInTheDocument();
    expect(screen.getByText(/w_remote/)).toBeInTheDocument();
    expect(screen.getByText(/secret-token/)).toBeInTheDocument();
  });
});
