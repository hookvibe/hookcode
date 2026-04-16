import { describe, expect, test } from 'vitest';
import { getWorkerProviderGuardDetails, getWorkerProviderRuntimeStatus } from '../utils/workerRuntime';

describe('workerRuntime utils', () => {
  test('derives provider runtime status from environment providerStatuses first', () => {
    const worker = {
      runtimeState: {
        providerStatuses: {
          codex: { status: 'ready', path: '/usr/local/bin/codex' }
        },
        availableProviders: ['codex']
      },
      capabilities: { providers: [] }
    } as any;

    expect(getWorkerProviderRuntimeStatus(worker, 'codex')).toBe('ready');
  });

  test('builds a provider guard for missing runtimes', () => {
    // Share one frontend guard helper between the worker panel and chat composer so missing Codex runtimes are blocked consistently before submit. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
    const worker = {
      runtimeState: {
        providerStatuses: {
          claude_code: { status: 'ready' }
        }
      },
      capabilities: { providers: ['claude_code'] }
    } as any;

    expect(
      getWorkerProviderGuardDetails({
        workerName: 'remote-1',
        provider: 'codex',
        worker
      })
    ).toEqual({
      reason: 'missing',
      providerLabel: 'Codex',
      workerName: 'remote-1'
    });
  });

  test('skips provider guard details when worker runtime availability is unknown', () => {
    const worker = {
      runtimeState: undefined,
      capabilities: {}
    } as any;

    expect(
      getWorkerProviderGuardDetails({
        workerName: 'remote-1',
        provider: 'codex',
        worker
      })
    ).toBeNull();
  });

  test('includes backend error details for failed provider setups', () => {
    const worker = {
      runtimeState: {
        providerStatuses: {
          codex: { status: 'error', error: 'npm exited with code 1' }
        }
      },
      capabilities: { providers: [] }
    } as any;

    expect(
      getWorkerProviderGuardDetails({
        workerName: 'remote-1',
        provider: 'codex',
        worker
      })
    ).toEqual({
      reason: 'error',
      providerLabel: 'Codex',
      workerName: 'remote-1',
      error: 'npm exited with code 1'
    });
  });
});
