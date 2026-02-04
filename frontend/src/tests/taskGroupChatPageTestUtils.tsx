// Share TaskGroupChatPage test setup and API mocks across spec files. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { render } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { vi } from 'vitest';
import { setLocale } from '../i18n';
import { TaskGroupChatPage } from '../pages/TaskGroupChatPage';
import * as api from '../api';

const NOW = '2026-01-11T00:00:00.000Z'; // Keep a shared test timestamp for setup helpers while mocks inline their own copy to avoid hoisted TDZ issues. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

vi.mock('../api', () => {
  const mockNow = '2026-01-11T00:00:00.000Z'; // Inline the timestamp so the hoisted mock factory does not touch module-level bindings. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
  const repo = {
    id: 'r1',
    provider: 'gitlab',
    name: 'Repo 1',
    enabled: true,
    createdAt: mockNow,
    updatedAt: mockNow
  };

  const robot = {
    id: 'bot1',
    repoId: 'r1',
    name: 'Robot 1',
    permission: 'read',
    // Include bound AI provider to exercise robot label formatting. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
    modelProvider: 'codex',
    enabled: true,
    isDefault: true,
    createdAt: mockNow,
    updatedAt: mockNow
  };

  const makeTask = (id: string) => ({
    id,
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: mockNow,
    updatedAt: mockNow
  });

  return {
    __esModule: true,
    API_BASE_URL: 'http://localhost:4000/api',
    executeChat: vi.fn(async () => ({
      taskGroup: {
        id: 'g_new',
        kind: 'chat',
        bindingKey: 'b1',
        title: 'Group new',
        repoId: repo.id,
        robotId: robot.id,
        createdAt: mockNow,
        updatedAt: mockNow
      },
      task: makeTask('t_new')
    })),
    fetchTask: vi.fn(async (id: string) => makeTask(id)),
    fetchTaskGroup: vi.fn(async (id: string) => ({
      id,
      kind: 'chat',
      bindingKey: 'b1',
      title: `Group ${id}`,
      repoId: repo.id,
      robotId: robot.id,
      createdAt: mockNow,
      updatedAt: mockNow
    })),
    fetchTaskGroupTasks: vi.fn(async () => []),
    // Mock preview endpoints so TaskGroupChatPage can render preview UI state. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    fetchTaskGroupPreviewStatus: vi.fn(async () => ({ available: false, instances: [] })),
    // Mock preview dependency reinstall endpoint for modal coverage. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    installTaskGroupPreviewDependencies: vi.fn(async () => ({
      success: true,
      result: { status: 'success', steps: [], totalDuration: 0 }
    })),
    listRepos: vi.fn(async () => [repo]),
    listRepoRobots: vi.fn(async () => [robot]),
    // Mock pause/resume APIs for task-group controls. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    pauseTask: vi.fn(async (id: string) => makeTask(id)),
    resumeTask: vi.fn(async (id: string) => makeTask(id)),
    startTaskGroupPreview: vi.fn(async () => ({ success: true, instances: [] })),
    stopTaskGroupPreview: vi.fn(async () => ({ success: true }))
  };
});

export const buildTaskGroupChatPageElement = (props?: { taskGroupId?: string; taskLogsEnabled?: boolean | null }) => (
  <AntdApp>
    <TaskGroupChatPage taskGroupId={props?.taskGroupId} taskLogsEnabled={props?.taskLogsEnabled} />
  </AntdApp>
); // Share a reusable element factory so rerenders keep the mocked api wiring. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export const renderTaskGroupChatPage = (props?: { taskGroupId?: string; taskLogsEnabled?: boolean | null }) =>
  render(buildTaskGroupChatPageElement(props));

export const setupTaskGroupChatMocks = () => {
  vi.clearAllMocks();
  setLocale('en-US');
  window.location.hash = '#/';

  // Ensure each test starts from a known mock baseline (avoid cross-test mock leakage).
  vi.mocked(api.listRepos).mockResolvedValue([
    { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true, createdAt: NOW, updatedAt: NOW } as any
  ]);
  vi.mocked(api.listRepoRobots).mockResolvedValue([
    {
      id: 'bot1',
      repoId: 'r1',
      name: 'Robot 1',
      permission: 'read',
      // Include bound AI provider to exercise robot label formatting. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
      modelProvider: 'codex',
      enabled: true,
      isDefault: true,
      createdAt: NOW,
      updatedAt: NOW
    } as any
  ]);
  vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([]);
  vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValue({ available: false, instances: [] });
  vi.mocked(api.installTaskGroupPreviewDependencies).mockResolvedValue({
    success: true,
    result: { status: 'success', steps: [], totalDuration: 0 }
  });
  vi.mocked(api.fetchTaskGroup).mockImplementation(async (id: string) => ({
    id,
    kind: 'chat',
    bindingKey: 'b1',
    title: `Group ${id}`,
    repoId: 'r1',
    robotId: 'bot1',
    createdAt: NOW,
    updatedAt: NOW
  }));
  vi.mocked(api.fetchTask).mockImplementation(async (id: string) => ({
    id,
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW
  }));
  // Keep pause/resume mocks in a stable default state for tests. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  vi.mocked(api.pauseTask).mockResolvedValue({
    id: 't_pause',
    eventType: 'chat',
    status: 'paused',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW
  } as any);
  vi.mocked(api.resumeTask).mockResolvedValue({
    id: 't_resume',
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW
  } as any);
  vi.mocked(api.executeChat).mockImplementation(async () => ({
    taskGroup: {
      id: 'g_new',
      kind: 'chat',
      bindingKey: 'b1',
      title: 'Group new',
      repoId: 'r1',
      robotId: 'bot1',
      createdAt: NOW,
      updatedAt: NOW
    },
    task: {
      id: 't_new',
      eventType: 'chat',
      status: 'queued',
      retries: 0,
      createdAt: NOW,
      updatedAt: NOW
    }
  }));
};
