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
  deleteWorker: vi.fn()
}));

const TEST_WORKER_VERSION = '9.9.9';

const buildVersionRequirement = () => ({
  packageName: '@hookvibe/hookcode-worker',
  requiredVersion: TEST_WORKER_VERSION,
  npmInstallCommand: `npm install -g @hookvibe/hookcode-worker@${TEST_WORKER_VERSION}`,
  cliUpgradeCommand: `hookcode-worker upgrade --to ${TEST_WORKER_VERSION}`,
  dockerImage: 'ghcr.io/hookvibe/hookcode-worker',
  dockerPullCommand: `docker pull ghcr.io/hookvibe/hookcode-worker:${TEST_WORKER_VERSION}`
});

// Verify the admin worker panel can load workers and reveal manual install guidance. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
const renderPanel = () =>
  render(
    <AntdApp>
      <SettingsWorkersPanel />
    </AntdApp>
  );

describe('SettingsWorkersPanel', () => {
  const defaultBackendUrl = 'http://yuhe.space:7213/api';

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
          isGlobalDefault: false,
          systemManaged: true,
          version: TEST_WORKER_VERSION,
          versionState: { currentVersion: TEST_WORKER_VERSION, status: 'compatible', upgradeRequired: false },
          maxConcurrency: 2,
          currentConcurrency: 0,
          createdAt: '2026-03-07T00:00:00.000Z',
          updatedAt: '2026-03-07T00:00:00.000Z'
        } as any
      ],
      versionRequirement: buildVersionRequirement(),
      defaultBackendUrl
    } as any);
    vi.mocked(api.createWorker).mockResolvedValue({
      worker: {
        id: 'w_remote',
        name: 'Remote worker',
        kind: 'remote',
        status: 'offline',
        isGlobalDefault: false,
        systemManaged: false,
        versionState: { status: 'unknown', upgradeRequired: true },
        maxConcurrency: 1,
        currentConcurrency: 0,
        createdAt: '2026-03-07T00:00:00.000Z',
        updatedAt: '2026-03-07T00:00:00.000Z'
      } as any,
      bindCode: 'hcw1.bind-code',
      bindCodeExpiresAt: '2026-03-08T00:00:00.000Z',
      backendUrl: defaultBackendUrl,
      versionRequirement: buildVersionRequirement()
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

  test('keeps the current table visible during silent polling refresh', async () => {
    vi.mocked(api.fetchWorkersRegistry).mockReset();
    const intervalHandlers: Array<() => void> = [];
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler) => {
      if (typeof handler === 'function') intervalHandlers.push(handler);
      return 1 as unknown as number;
    }) as typeof window.setInterval);
    vi.mocked(api.fetchWorkersRegistry)
      .mockResolvedValueOnce({
        workers: [
          {
            id: 'w_local',
            name: 'Local worker',
            kind: 'local',
            status: 'online',
            isGlobalDefault: false,
            systemManaged: true,
            version: TEST_WORKER_VERSION,
            versionState: { currentVersion: TEST_WORKER_VERSION, status: 'compatible', upgradeRequired: false },
            maxConcurrency: 2,
            currentConcurrency: 0,
            createdAt: '2026-03-07T00:00:00.000Z',
            updatedAt: '2026-03-07T00:00:00.000Z'
          } as any
        ],
        versionRequirement: buildVersionRequirement(),
        defaultBackendUrl
      } as any)
      .mockImplementationOnce(() => new Promise(() => {}));

    try {
      renderPanel();

      expect(await screen.findByText('Local worker')).toBeInTheDocument();
      expect(intervalHandlers.length).toBeGreaterThan(0);

      intervalHandlers.forEach((handler) => handler());

      await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalledTimes(2));
      expect(screen.getByText('Local worker')).toBeInTheDocument();
    } finally {
      setIntervalSpy.mockRestore();
    }
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
    expect((screen.getByLabelText('Backend URL') as HTMLInputElement).value).toBe(defaultBackendUrl);
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createWorker).toHaveBeenCalledWith({ name: 'Remote worker', maxConcurrency: 1, backendUrl: defaultBackendUrl }));
    expect(await screen.findByText('Manual deployment')).toBeInTheDocument();
    await ui.click(screen.getByRole('tab', { name: 'hookcode-worker dev' }));
    expect(screen.getByRole('tab', { name: 'Linux (systemd)' })).toBeInTheDocument();
    expect(screen.getAllByText(/hcw1\.bind-code/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(`npm install -g @hookvibe/hookcode-worker@${TEST_WORKER_VERSION.replace(/\./g, '\\.')}`)).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(defaultBackendUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(screen.getByText('.env.worker.local')).toBeInTheDocument();
    expect(screen.getByText('pnpm dev')).toBeInTheDocument();
    expect(screen.getAllByText(/HOOKCODE_WORKER_BIND_CODE=\"hcw1\.bind-code\"/).length).toBeGreaterThan(0);
  });

  test('allows promoting a worker as the global default', async () => {
    const ui = userEvent.setup();
    vi.mocked(api.updateWorker).mockResolvedValue({
      worker: {
        id: 'w_local',
        name: 'Local worker',
        kind: 'local',
        status: 'online',
        isGlobalDefault: true,
        systemManaged: true,
        versionState: { currentVersion: TEST_WORKER_VERSION, status: 'compatible', upgradeRequired: false },
        maxConcurrency: 2,
        currentConcurrency: 0,
        createdAt: '2026-03-07T00:00:00.000Z',
        updatedAt: '2026-03-07T00:00:00.000Z'
      } as any
    });
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Set default' }));

    await waitFor(() => expect(api.updateWorker).toHaveBeenCalledWith('w_local', { isGlobalDefault: true }));
  });

  test('shows per-provider environment availability details', async () => {
    vi.mocked(api.fetchWorkersRegistry).mockResolvedValueOnce({
      workers: [
        {
          id: 'w_local',
          name: 'Local worker',
          kind: 'local',
          status: 'online',
          isGlobalDefault: false,
          systemManaged: true,
          version: TEST_WORKER_VERSION,
          versionState: { currentVersion: TEST_WORKER_VERSION, status: 'compatible', upgradeRequired: false },
          runtimeState: {
            providerStatuses: {
              codex: {
                status: 'ready',
                version: 'codex 0.120.0',
                path: '/usr/local/bin/codex'
              },
              claude_code: {
                status: 'error',
                version: 'claude 1.0.0',
                path: '/usr/local/bin/claude',
                error: 'permission denied'
              },
              gemini_cli: {
                status: 'idle',
                command: 'gemini'
              }
            },
            availableProviders: ['codex'],
            lastCheckedAt: '2026-03-07T01:02:03.000Z',
            lastCheckError: 'Claude Code: permission denied'
          },
          maxConcurrency: 2,
          currentConcurrency: 0,
          createdAt: '2026-03-07T00:00:00.000Z',
          updatedAt: '2026-03-07T00:00:00.000Z'
        } as any
      ],
      versionRequirement: buildVersionRequirement(),
      defaultBackendUrl
    } as any);
    renderPanel();

    expect(await screen.findByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Gemini CLI')).toBeInTheDocument();
    expect(screen.getByText(/Version: codex 0\.120\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Path: \/usr\/local\/bin\/codex/)).toBeInTheDocument();
    expect(screen.getByText(/Path: \/usr\/local\/bin\/claude/)).toBeInTheDocument();
    expect(screen.getByText('permission denied')).toBeInTheDocument();
    expect(screen.getByText(/Command: gemini/)).toBeInTheDocument();
    expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prepare runtime' })).not.toBeInTheDocument();
  });

  test('allows overriding the backend url before generating the bind code', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    await ui.type(await screen.findByLabelText('Name'), 'Remote worker');
    const backendUrlInput = screen.getByLabelText('Backend URL');
    await ui.clear(backendUrlInput);
    await ui.type(backendUrlInput, 'https://edge.example.com/root');
    await ui.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(api.createWorker).toHaveBeenCalledWith({
        name: 'Remote worker',
        maxConcurrency: 1,
        backendUrl: 'https://edge.example.com/root'
      })
    );
  });

  test('uses the themed compact modal skin for worker creation', async () => {
    const ui = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(api.fetchWorkersRegistry).toHaveBeenCalled());
    await ui.click(screen.getByRole('button', { name: 'Create worker' }));

    expect(document.querySelector('.hc-dialog--compact')).toBeTruthy();
  });
});
