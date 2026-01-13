import { postToProvider } from '../../agent/reporter';
import type { Task } from '../../types/task';

const now = () => new Date().toISOString();

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

    expect(gitlab.addMergeRequestDiscussionNote).toHaveBeenCalledWith(123, 1, 'd1', 'hello');
    expect(gitlab.addMergeRequestNote).toHaveBeenCalledWith(123, 1, 'hello');
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

    expect(gitlab.addIssueDiscussionNote).toHaveBeenCalledWith(123, 2, 'd2', 'hello');
    expect(gitlab.addIssueNote).toHaveBeenCalledWith(123, 2, 'hello');
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

    expect(gitlab.addIssueDiscussionNote).toHaveBeenCalledWith(25, 12, 'd3', 'hello');
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
