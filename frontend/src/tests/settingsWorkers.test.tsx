import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp } from 'antd';
import { SettingsWorkersPanel } from '../components/settings/SettingsWorkersPanel';
import { SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME } from '../components/settings/layout';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  __esModule: true,
  fetchWorkersRegistry: vi.fn(),
  createWorker: vi.fn(),
  updateWorker: vi.fn(),
  resetWorkerBindCode: vi.fn(),
  prepareWorkerRuntime: vi.fn(),
  deleteWorker: vi.fn()
}));

// Verify the admin worker panel can load workers and reveal manual install guidance. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
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
    vi.mocked(api.fetchWorkersRegistry).mockResolvedValue({
      workers: [
        {
          id: 'w_local',
          name: 'Local worker',
          kind: 'local',
          status: 'online',
          systemManaged: true,
          version: '0.1.2',
          versionState: { currentVersion: '0.1.2', status: 'compatible', upgradeRequired: false },
          maxConcurrency: 2,
          currentConcurrency: 0,
          createdAt: '2026-03-07T00:00:00.000Z',
          updatedAt: '2026-03-07T00:00:00.000Z'
        } as any
      ],
      versionRequirement: {
        packageName: '@hookvibe/hookcode-worker',
        requiredVersion: '0.1.2',
        npmInstallCommand: 'npm install -g @hookvibe/hookcode-worker@0.1.2',
        cliUpgradeCommand: 'hookcode-worker upgrade --to 0.1.2',
        dockerImage: 'ghcr.io/hookvibe/hookcode-worker',
        dockerPullCommand: 'docker pull ghcr.io/hookvibe/hookcode-worker:0.1.2'
      }
    } as any);
    vi.mocked(api.createWorker).mockResolvedValue({
      worker: {
        id: 'w_remote',
        name: 'Remote worker',
        kind: 'remote',
        status: 'offline',
        systemManaged: false,
        versionState: { status: 'unknown', upgradeRequired: true },
        maxConcurrency: 1,
        currentConcurrency: 0,
        createdAt: '2026-03-07T00:00:00.000Z',
        updatedAt: '2026-03-07T00:00:00.000Z'
      } as any,
      bindCode: 'hcw1.bind-code',
      bindCodeExpiresAt: '2026-03-08T00:00:00.000Z',
      versionRequirement: {
        packageName: '@hookvibe/hookcode-worker',
        requiredVersion: '0.1.2',
        npmInstallCommand: 'npm install -g @hookvibe/hookcode-worker@0.1.2',
        cliUpgradeCommand: 'hookcode-worker upgrade --to 0.1.2',
        dockerImage: 'ghcr.io/hookvibe/hookcode-worker',
        dockerPullCommand: 'docker pull ghcr.io/hookvibe/hookcode-worker:0.1.2'
      }
    } as any);
  });

  test('loads workers into the registry table', async () => {
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    expect(await screen.findByText('Local worker')).toBeInTheDocument();
    expect(screen.getByText('System managed')).toBeInTheDocument();
    expect(screen.getByText('Worker version requirement')).toBeInTheDocument();
    expect(document.querySelector(`.${SETTINGS_STICKY_ACTIONS_TABLE_CLASS_NAME.replace(/ /g, '.')}`)).toBeTruthy();
    expect(document.querySelector('.ant-table-has-fix-end')).toBeTruthy();
  });


  test('surfaces backend create validation errors to the user', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.createWorker).mockRejectedValueOnce({ response: { data: { error: 'name is required' } } } as any);
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    await ui.type(await screen.findByLabelText('Name'), 'Remote worker');
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('name is required')).toBeInTheDocument();
  });

  test('blocks whitespace-only worker names before calling the API', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    await ui.type(await screen.findByLabelText('Name'), '   ');
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createWorker).not.toHaveBeenCalled());
    expect(await screen.findAllByText('Required')).not.toHaveLength(0);
  });

  test('creates a remote worker and shows manual install guidance', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    await ui.type(await screen.findByLabelText('Name'), 'Remote worker');
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createWorker).toHaveBeenCalledWith({ name: 'Remote worker', maxConcurrency: 1 }));
    expect(await screen.findByText('Manual deployment')).toBeInTheDocument();
    expect(screen.getAllByText(/hcw1\.bind-code/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/npm install -g @hookvibe\/hookcode-worker@0\.1\.2/).length).toBeGreaterThan(0);
  });

  test('uses the themed compact modal skin for worker creation', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    expect(document.querySelector('.hc-dialog--compact')).toBeTruthy();
  });
});
