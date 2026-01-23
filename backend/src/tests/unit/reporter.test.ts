import { postToProvider } from '../../agent/reporter';
import type { Task } from '../../types/task';

const now = () => new Date().toISOString();

// Verify reporter prepends trigger-comment backlinks for comment-triggered tasks. docs/en/developer/plans/commentreply20260122r9k2/task_plan.md commentreply20260122r9k2
// Verify reporter appends a HookCode task detail footer link in provider messages. docs/en/developer/plans/taskdetailbacklink20260122k4p8/task_plan.md taskdetailbacklink20260122k4p8

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

const prevConsoleTaskPrefix = process.env.HOOKCODE_CONSOLE_TASK_URL_PREFIX;

beforeAll(() => {
  setEnv('HOOKCODE_CONSOLE_TASK_URL_PREFIX', 'https://hookcode.example/#/tasks/');
});

afterAll(() => {
  setEnv('HOOKCODE_CONSOLE_TASK_URL_PREFIX', prevConsoleTaskPrefix);
});

describe('postToProvider (HookCode task link footer)', () => {
  test('appends a stable task detail link footer', async () => {
    const github: any = {
      addIssueComment: jest.fn().mockResolvedValue({ html_url: 'https://github.com/owner/repo/issues/1#issuecomment-7' }),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 'task_1',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      issueId: 1,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = { repository: { full_name: 'owner/repo' } };

    await postToProvider({ provider: 'github', task, payload, body: 'hello', github });

    expect(github.addIssueComment).toHaveBeenCalledWith(
      'owner',
      'repo',
      1,
      'hello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/task_1)'
    );
  });
});

describe('postToProvider (skip guards)', () => {
  test('skips posting when eventType=chat even without provider clients', async () => {
    const task: Task = {
      id: 't_chat',
      eventType: 'chat',
      status: 'processing',
      payload: {},
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    await expect(
      postToProvider({ provider: 'gitlab', task, payload: {}, body: 'hello' })
    ).resolves.toEqual({});
  });

  test('skips posting when payload.__skipProviderPost=true even without provider clients', async () => {
    const task: Task = {
      id: 't_skip',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    await expect(
      postToProvider({ provider: 'github', task, payload: { __skipProviderPost: true }, body: 'hello' })
    ).resolves.toEqual({});
  });
});

describe('postToProvider (gitlab)', () => {
  test('commented 场景应在 body 前追加触发 note 的链接（gitlab web url）', async () => {
    const gitlab: any = {
      addMergeRequestDiscussionNote: jest.fn(),
      addMergeRequestNote: jest.fn(),
      addIssueDiscussionNote: jest.fn(),
      addIssueNote: jest.fn().mockResolvedValue({ id: 1 }),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't_backlink_gl',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      projectId: 25,
      issueId: 12,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      __subType: 'commented',
      project: { id: 25, web_url: 'https://gitlab.example.com/group/repo' },
      issue: { iid: 12 },
      object_attributes: { id: 321, noteable_type: 'Issue' }
    };

    await postToProvider({ provider: 'gitlab', task, payload, body: 'hello', gitlab });

    expect(gitlab.addIssueNote).toHaveBeenCalledWith(
      25,
      12,
      '> Triggered by: https://gitlab.example.com/group/repo/-/issues/12#note_321\n\nhello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t_backlink_gl)'
    );
  });

  test('discussion 回复失败时降级为普通 MR note', async () => {
    const gitlab: any = {
      addMergeRequestDiscussionNote: jest.fn().mockRejectedValue(new Error('[gitlab] 404 Not Found')),
      addMergeRequestNote: jest.fn().mockResolvedValue({ id: 1 }),
      addIssueDiscussionNote: jest.fn(),
      addIssueNote: jest.fn(),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't1',
      eventType: 'merge_request',
      status: 'processing',
      payload: {},
      projectId: 123,
      mrId: 1,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      project: { id: 123 },
      object_attributes: { discussion_id: '  d1  ' }
    };

    await postToProvider({ provider: 'gitlab', task, payload, body: 'hello', gitlab });

    expect(gitlab.addMergeRequestDiscussionNote).toHaveBeenCalledWith(
      123,
      1,
      'd1',
      'hello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t1)'
    );
    expect(gitlab.addMergeRequestNote).toHaveBeenCalledWith(123, 1, 'hello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t1)');
  });

  test('discussion 回复失败时降级为普通 Issue note', async () => {
    const gitlab: any = {
      addMergeRequestDiscussionNote: jest.fn(),
      addMergeRequestNote: jest.fn(),
      addIssueDiscussionNote: jest.fn().mockRejectedValue(new Error('[gitlab] 404 Not Found')),
      addIssueNote: jest.fn().mockResolvedValue({ id: 1 }),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't2',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      projectId: 123,
      issueId: 2,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      project: { id: 123 },
      object_attributes: { discussion_id: 'd2' }
    };

    await postToProvider({ provider: 'gitlab', task, payload, body: 'hello', gitlab });

    expect(gitlab.addIssueDiscussionNote).toHaveBeenCalledWith(
      123,
      2,
      'd2',
      'hello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t2)'
    );
    expect(gitlab.addIssueNote).toHaveBeenCalledWith(123, 2, 'hello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t2)');
  });

  test('commented 场景优先使用 payload.issue.iid（避免 task.issueId 被误写为 note.id）', async () => {
    const gitlab: any = {
      addMergeRequestDiscussionNote: jest.fn(),
      addMergeRequestNote: jest.fn(),
      addIssueDiscussionNote: jest.fn().mockResolvedValue({ id: 1 }),
      addIssueNote: jest.fn(),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't3',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      projectId: 25,
      // Assume a legacy/abnormal task wrote note.id here (e.g. 397).
      issueId: 397,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      __subType: 'commented',
      project: { id: 25 },
      issue: { iid: 12 },
      object_attributes: { discussion_id: 'd3' }
    };

    await postToProvider({ provider: 'gitlab', task, payload, body: 'hello', gitlab });

    expect(gitlab.addIssueDiscussionNote).toHaveBeenCalledWith(
      25,
      12,
      'd3',
      'hello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t3)'
    );
  });

  test('成功回写后应返回可跳转的 note 链接（用于控制台快捷入口）', async () => {
    const gitlab: any = {
      addMergeRequestDiscussionNote: jest.fn(),
      addMergeRequestNote: jest.fn(),
      addIssueDiscussionNote: jest.fn(),
      addIssueNote: jest.fn().mockResolvedValue({ id: 99 }),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't4',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      projectId: 25,
      issueId: 12,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      project: { id: 25, web_url: 'https://gitlab.example.com/group/repo' },
      issue: { iid: 12 }
    };

    const result = await postToProvider({ provider: 'gitlab', task, payload, body: 'hello', gitlab });

    expect(result.url).toBe('https://gitlab.example.com/group/repo/-/issues/12#note_99');
  });
});

describe('postToProvider (github)', () => {
  test('commented 场景应在 body 前追加触发 comment 的链接（github html_url）', async () => {
    const github: any = {
      addIssueComment: jest.fn().mockResolvedValue({ html_url: 'https://github.com/owner/repo/issues/1#issuecomment-7' }),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't_backlink_gh',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      issueId: 1,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      __subType: 'commented',
      repository: { full_name: 'owner/repo' },
      comment: { html_url: 'https://github.com/owner/repo/issues/1#issuecomment-1' }
    };

    await postToProvider({ provider: 'github', task, payload, body: 'hello', github });

    expect(github.addIssueComment).toHaveBeenCalledWith(
      'owner',
      'repo',
      1,
      '> Triggered by: https://github.com/owner/repo/issues/1#issuecomment-1\n\nhello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t_backlink_gh)'
    );
  });

  test('mrId 场景应回写到 PR 对应的 issue comment 入口（兼容 GitHub PR number）', async () => {
    const github: any = {
      addIssueComment: jest.fn().mockResolvedValue({ html_url: 'https://github.com/owner/repo/pull/2#issuecomment-9' }),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't_pr',
      eventType: 'merge_request',
      status: 'processing',
      payload: {},
      mrId: 2,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      repository: { full_name: 'owner/repo' }
    };

    const result = await postToProvider({ provider: 'github', task, payload, body: 'hello', github });

    expect(github.addIssueComment).toHaveBeenCalledWith('owner', 'repo', 2, 'hello\n\n[`HookCode · Task`](https://hookcode.example/#/tasks/t_pr)');
    expect(result.url).toBe('https://github.com/owner/repo/pull/2#issuecomment-9');
  });

  test('成功回写后应返回 comment.html_url', async () => {
    const github: any = {
      addIssueComment: jest.fn().mockResolvedValue({ html_url: 'https://github.com/owner/repo/issues/1#issuecomment-7' }),
      addCommitComment: jest.fn()
    };

    const task: Task = {
      id: 't5',
      eventType: 'issue',
      status: 'processing',
      payload: {},
      issueId: 1,
      retries: 0,
      createdAt: now(),
      updatedAt: now()
    };

    const payload = {
      repository: { full_name: 'owner/repo' }
    };

    const result = await postToProvider({ provider: 'github', task, payload, body: 'hello', github });

    expect(result.url).toBe('https://github.com/owner/repo/issues/1#issuecomment-7');
  });
});
