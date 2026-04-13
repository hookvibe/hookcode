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
    scope: 'repo',
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
    fetchTaskWorkspace: vi.fn(async () => ({
      source: 'snapshot',
      live: false,
      readOnly: true,
      capturedAt: mockNow,
      branch: 'main',
      headSha: '1234567890abcdef',
      workingTree: { staged: [], unstaged: [], untracked: [] },
      summary: { total: 0, staged: 0, unstaged: 0, untracked: 0, additions: 0, deletions: 0, hasChanges: false },
      files: [],
      canCommit: false
    })),
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
    fetchTaskGroupSkillSelection: vi.fn(async () => ({
      selection: null,
      effective: ['built_in:hookcode-preview-highlight'],
      mode: 'repo_default'
    })),
    fetchTaskGroupTasks: vi.fn(async () => []),
    // Keep task-log pagination mocked so TaskGroup timeline tests can drive chained scroll behavior. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    fetchTaskLogsPage: vi.fn(async () => ({ logs: [], startSeq: 0, endSeq: 0, nextBefore: null })),
    // Mock preview endpoints so TaskGroupChatPage can render preview UI state. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    fetchTaskGroupPreviewStatus: vi.fn(async () => ({ available: false, instances: [] })),
    // Mock preview visibility updates for hidden auto-stop logic. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
    setTaskGroupPreviewVisibility: vi.fn(async () => ({ success: true })),
    // Mock preview dependency reinstall endpoint for modal coverage. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    installTaskGroupPreviewDependencies: vi.fn(async () => ({
      success: true,
      result: { status: 'success', steps: [], totalDuration: 0 }
    })),
    // Provide full repo list mocks for chat repo selection after pagination changes. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    fetchAllRepos: vi.fn(async () => [repo]),
    fetchWorkers: vi.fn(async () => [{ id: 'w1', name: 'Worker 1', kind: 'remote', status: 'online', isGlobalDefault: false, systemManaged: false, maxConcurrency: 1, currentConcurrency: 0, createdAt: mockNow, updatedAt: mockNow }]),
    listRepoRobots: vi.fn(async () => [robot]),
    // Keep chat page tests aligned with the mixed-scope robot catalog fetch used by the composer. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    listAvailableRepoRobots: vi.fn(async () => [robot]),
    // Mock stop/edit/reorder APIs for the task-group workspace controls. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    stopTask: vi.fn(async (id: string) => ({ ...makeTask(id), status: 'failed', result: { stopReason: 'manual_stop' } })),
    retryTask: vi.fn(async (id: string) => makeTask(id)),
    deleteTask: vi.fn(async () => undefined),
    runTaskWorkspaceOperation: vi.fn(async () => ({
      workspace: {
        source: 'snapshot',
        live: false,
        readOnly: true,
        capturedAt: mockNow,
        branch: 'main',
        headSha: '1234567890abcdef',
        workingTree: { staged: [], unstaged: [], untracked: [] },
        summary: { total: 0, staged: 0, unstaged: 0, untracked: 0, additions: 0, deletions: 0, hasChanges: false },
        files: [],
        canCommit: false
      }
    })),
    pushTaskGitChanges: vi.fn(async (id: string) => makeTask(id)),
    updateQueuedTaskContent: vi.fn(async (id: string, text: string) => ({ ...makeTask(id), payload: { __chat: { text } } })),
    reorderQueuedTask: vi.fn(async (id: string) => makeTask(id)),
    startTaskGroupPreview: vi.fn(async () => ({ success: true, instances: [] })),
    stopTaskGroupPreview: vi.fn(async () => ({ success: true })),
    updateTaskGroupSkillSelection: vi.fn(async () => ({
      selection: [],
      effective: [],
      mode: 'custom'
    })),
    fetchSkills: vi.fn(async () => ({ builtIn: [], extra: [], builtInNextCursor: null, extraNextCursor: null }))
  };
});

export const buildTaskGroupChatPageElement = (props?: { taskGroupId?: string }) => (
  <AntdApp>
    <TaskGroupChatPage taskGroupId={props?.taskGroupId} />
  </AntdApp>
); // Share a reusable task-group page factory after removing the retired log-flag prop from workspace tests. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306

export const renderTaskGroupChatPage = (props?: { taskGroupId?: string }) =>
  render(buildTaskGroupChatPageElement(props));

export const setupTaskGroupChatMocks = () => {
  vi.clearAllMocks();
  setLocale('en-US');
  window.location.hash = '#/';
  window.localStorage.removeItem('hookcode-user');

  // Ensure each test starts from a known mock baseline (avoid cross-test mock leakage).
  // Reset repo list mocks to match fetchAllRepos usage. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  vi.mocked(api.fetchAllRepos).mockResolvedValue([
    { id: 'r1', provider: 'gitlab', name: 'Repo 1', enabled: true, createdAt: NOW, updatedAt: NOW } as any
  ]);
  vi.mocked(api.fetchWorkers).mockResolvedValue([
    { id: 'w1', name: 'Worker 1', kind: 'remote', status: 'online', isGlobalDefault: false, systemManaged: false, maxConcurrency: 1, currentConcurrency: 0, createdAt: NOW, updatedAt: NOW } as any
  ]);
  vi.mocked(api.listRepoRobots).mockResolvedValue([
    {
      id: 'bot1',
      scope: 'repo',
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
  vi.mocked(api.listAvailableRepoRobots).mockResolvedValue([
    {
      id: 'bot1',
      scope: 'repo',
      repoId: 'r1',
      name: 'Robot 1',
      permission: 'read',
      // Keep available-robot labels stable for mixed-scope chat selector coverage. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
      modelProvider: 'codex',
      enabled: true,
      isDefault: true,
      createdAt: NOW,
      updatedAt: NOW
    } as any
  ]);
  vi.mocked(api.fetchTaskGroupTasks).mockResolvedValue([]);
  // Reset log-page mocks so each timeline test starts from a known chain-pagination baseline. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  vi.mocked(api.fetchTaskLogsPage).mockResolvedValue({ logs: [], startSeq: 0, endSeq: 0, nextBefore: null } as any);
  vi.mocked(api.fetchTaskGroupPreviewStatus).mockResolvedValue({ available: false, instances: [] });
  // Reset preview visibility mock per test run. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
  vi.mocked(api.setTaskGroupPreviewVisibility).mockResolvedValue({ success: true });
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
  vi.mocked(api.fetchTaskGroupSkillSelection).mockResolvedValue({
    selection: null,
    effective: ['built_in:hookcode-preview-highlight'],
    mode: 'repo_default'
  } as any);
  vi.mocked(api.updateTaskGroupSkillSelection).mockResolvedValue({
    selection: [],
    effective: [],
    mode: 'custom'
  } as any);
  // Reset skill list mocks to include pagination cursors. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  vi.mocked(api.fetchSkills).mockResolvedValue({ builtIn: [], extra: [], builtInNextCursor: null, extraNextCursor: null } as any);
  vi.mocked(api.fetchTask).mockImplementation(async (id: string) => ({
    id,
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW
  }));
  vi.mocked(api.fetchTaskWorkspace).mockResolvedValue({
    source: 'snapshot',
    live: false,
    readOnly: true,
    capturedAt: NOW,
    branch: 'main',
    headSha: '1234567890abcdef',
    workingTree: { staged: [], unstaged: [], untracked: [] },
    summary: { total: 0, staged: 0, unstaged: 0, untracked: 0, additions: 0, deletions: 0, hasChanges: false },
    files: [],
    canCommit: false
  } as any);
  vi.mocked(api.runTaskWorkspaceOperation).mockResolvedValue({
    workspace: {
      source: 'snapshot',
      live: false,
      readOnly: true,
      capturedAt: NOW,
      branch: 'main',
      headSha: '1234567890abcdef',
      workingTree: { staged: [], unstaged: [], untracked: [] },
      summary: { total: 0, staged: 0, unstaged: 0, untracked: 0, additions: 0, deletions: 0, hasChanges: false },
      files: [],
      canCommit: false
    }
  } as any);
  vi.mocked(api.pushTaskGitChanges).mockResolvedValue({
    id: 't_push',
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW
  } as any);
  // Keep stop/edit/retry/reorder mocks in a stable default state for workspace tests. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  vi.mocked(api.stopTask).mockResolvedValue({
    id: 't_stop',
    eventType: 'chat',
    status: 'failed',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW,
    result: { stopReason: 'manual_stop' }
  } as any);
  vi.mocked(api.retryTask).mockResolvedValue({
    id: 't_retry',
    eventType: 'chat',
    status: 'queued',
    retries: 1,
    createdAt: NOW,
    updatedAt: NOW
  } as any);
  vi.mocked(api.deleteTask).mockResolvedValue(undefined);
  vi.mocked(api.updateQueuedTaskContent).mockImplementation(async (id: string, text: string) => ({
    id,
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW,
    payload: { __chat: { text } }
  }) as any);
  vi.mocked(api.reorderQueuedTask).mockImplementation(async (id: string) => ({
    id,
    eventType: 'chat',
    status: 'queued',
    retries: 0,
    createdAt: NOW,
    updatedAt: NOW
  }) as any);
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
