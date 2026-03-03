import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsPreviewPanel } from '../components/settings/SettingsPreviewPanel';
import { setLocale } from '../i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchPreviewAdminOverview: vi.fn(async () => ({
    generatedAt: '2026-03-03T00:00:00.000Z',
    activeTaskGroups: [
      {
        taskGroupId: 'group-a',
        taskGroupTitle: 'Group A',
        repoId: 'repo-1',
        aggregateStatus: 'running',
        instances: [{ name: 'frontend', status: 'running', port: 10000 }]
      }
    ],
    portAllocation: {
      rangeStart: 10000,
      rangeEnd: 10999,
      capacity: 1000,
      inUseCount: 1,
      availableCount: 999,
      inUsePorts: [10000],
      allocations: [{ taskGroupId: 'group-a', ports: [10000] }]
    }
  }))
}));

// Validate settings preview panel rendering for admin preview management cards. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
describe('SettingsPreviewPanel', () => {
  beforeEach(() => {
    setLocale('en-US');
    vi.clearAllMocks();
  });

  test('renders active groups and port allocation', async () => {
    render(<SettingsPreviewPanel />);

    await waitFor(() => expect(api.fetchPreviewAdminOverview).toHaveBeenCalled());
    expect(await screen.findByText('Group A')).toBeInTheDocument();
    expect(screen.getAllByText('group-a').length).toBeGreaterThan(0);
    expect(screen.getByText('frontend: Running (10000)')).toBeInTheDocument();
    expect(screen.getByText('Range: 10000 - 10999')).toBeInTheDocument();
  });

  test('renders empty-state copy when no active groups exist', async () => {
    vi.mocked(api.fetchPreviewAdminOverview).mockResolvedValueOnce({
      generatedAt: '2026-03-03T00:00:00.000Z',
      activeTaskGroups: [],
      portAllocation: {
        rangeStart: 10000,
        rangeEnd: 10999,
        capacity: 1000,
        inUseCount: 0,
        availableCount: 1000,
        inUsePorts: [],
        allocations: []
      }
    });

    render(<SettingsPreviewPanel />);

    await waitFor(() => expect(api.fetchPreviewAdminOverview).toHaveBeenCalled());
    expect(await screen.findByText('No active preview task groups.')).toBeInTheDocument();
  });
});
