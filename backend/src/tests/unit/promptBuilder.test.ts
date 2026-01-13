import { buildPrompt } from '../../agent/promptBuilder';
import type { BuildPromptInput } from '../../agent/promptBuilder';
import type { GitlabService } from '../../services/gitlabService';
import type { RepoRobot } from '../../types/repoRobot';
import type { Repository } from '../../types/repository';
import type { Task } from '../../types/task';

const iso = new Date(0).toISOString();

const baseRepo = (): Repository => ({
  id: 'repo-1',
  provider: 'gitlab',
  name: 'hookcode',
  branches: [],
  enabled: true,
  createdAt: iso,
  updatedAt: iso
});

const baseRobot = (): RepoRobot => ({
  id: 'rb-1',
  repoId: 'repo-1',
  name: 'hookcode-review',
  permission: 'read',
  hasToken: false,
  promptDefault: 'DEFAULT {{repo.name}} {{robot.name}}',
  enabled: true,
  isDefault: true,
  createdAt: iso,
  updatedAt: iso
});

const baseTask = (): Task => ({
  id: 'task-1',
  eventType: 'commit',
  status: 'queued',
  payload: {},
  retries: 0,
  createdAt: iso,
  updatedAt: iso
});

describe('promptBuilder.buildPrompt', () => {
  test('robot.language：可通过模板变量渲染', async () => {
    const repo = baseRepo();
    const robot = { ...baseRobot(), promptDefault: 'LANG={{robot.language}}', language: 'en-US' };
    const task = { ...baseTask(), ref: 'refs/heads/dev' };

    const input: BuildPromptInput = {
      task,
      payload: { __subType: 'created', ref: 'refs/heads/dev' },
      repo,
      checkout: { branch: 'main', source: 'robot' },
      robot,
      robotsInRepo: [robot]
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain('LANG=en-US');
  });

  test('存在 promptCustom 时：prompt 仅由模板渲染（不会额外拼接固定区块）', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const sha = 'a'.repeat(40);
    const task = {
      ...baseTask(),
      promptCustom: ['CUSTOM_INSTRUCTION', 'branch={{commit.branch}} sha={{commit.sha}} msg={{commit.message}}'].join(
        '\n\n'
      ),
      ref: 'refs/heads/dev'
    };

    const input: BuildPromptInput = {
      task,
      payload: { __subType: 'created', ref: 'refs/heads/dev', after: sha, commits: [{ message: 'feat: demo' }] },
      repo,
      checkout: { branch: 'main', source: 'robot' },
      robot,
      robotsInRepo: [robot]
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body.startsWith('CUSTOM_INSTRUCTION')).toBe(true);
    expect(ctx.body).toContain('branch=dev');
    expect(ctx.body).toContain(`sha=${sha}`);
    expect(ctx.body).toContain('msg=feat: demo');
    expect(ctx.body).not.toContain('角色：');
  });

  test('commit（created）：payload 缺少 after 时，仍可从 commits[] 解析 commit.sha/commit.message', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const sha = 'b'.repeat(40);
    const task = {
      ...baseTask(),
      promptCustom: ['sha={{commit.sha}}', 'msg={{commit.message}}', 'branch={{commit.branch}}'].join('\n'),
      ref: 'refs/heads/main'
    };

    const input: BuildPromptInput = {
      task,
      payload: {
        __subType: 'created',
        ref: 'refs/heads/main',
        commits: [{ id: sha, title: 'fix: title only' }]
      },
      repo,
      robot,
      robotsInRepo: [robot]
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain(`sha=${sha}`);
    expect(ctx.body).toContain('msg=fix: title only');
    expect(ctx.body).toContain('branch=main');
  });

  test('不存在 promptCustom 时：使用 robot.promptDefault 作为提示词模板', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const task = { ...baseTask(), ref: 'refs/heads/dev' };

    const input: BuildPromptInput = {
      task,
      payload: { __subType: 'created', ref: 'refs/heads/dev' },
      repo,
      checkout: { branch: 'main', source: 'robot' },
      robot,
      robotsInRepo: [robot]
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain('DEFAULT hookcode hookcode-review');
  });

  test('Issue 场景：promptCustom 可使用 issue 模板变量，且自定义提示词仅出现一次', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const task: Task = {
      ...baseTask(),
      eventType: 'issue',
      issueId: 5,
      repoProvider: 'gitlab',
      promptCustom: [
        'Issue={{issue.number}} Id={{issue.id}} Title={{issue.title}} Body={{issue.body}} Url={{issue.url}}',
        '{{issue.block}}'
      ].join('\n\n')
    };

    const gitlab = {
      getIssue: jest.fn().mockResolvedValue({
        id: 100,
        iid: 5,
        project_id: 123,
        title: '加入触发器的 issue',
        description: '加入触发器的 issue',
        state: 'opened',
        web_url: 'http://example.com/issues/5'
      }),
      getIssueById: jest.fn(),
      listIssueNotes: jest.fn().mockResolvedValue([])
    } as unknown as GitlabService;

    const input: BuildPromptInput = {
      task,
      payload: { project: { id: 123 }, __subType: 'commented' },
      repo,
      robot,
      robotsInRepo: [robot],
      gitlab
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain(
      'Issue=5 Id=100 Title=加入触发器的 issue Body=加入触发器的 issue Url=http://example.com/issues/5'
    );
  });

  test('GitLab Issue：当任务里是 issue.id 且 payload 无 iid 时，仍可通过 getIssueById 拉取并渲染模板变量', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const task: Task = {
      ...baseTask(),
      eventType: 'issue',
      issueId: 100,
      repoProvider: 'gitlab',
      promptCustom: ['Issue={{issue.number}} Id={{issue.id}} Body={{issue.body}}', '{{issue.block}}'].join('\n\n')
    };

    const gitlab = {
      getIssue: jest.fn().mockRejectedValue(new Error('404')),
      getIssueById: jest.fn().mockResolvedValue({
        id: 100,
        iid: 5,
        project_id: 123,
        title: 'Issue from id',
        description: 'content from id',
        state: 'opened',
        web_url: 'http://example.com/issues/5'
      }),
      listIssueNotes: jest.fn().mockResolvedValue([])
    } as unknown as GitlabService;

    const input: BuildPromptInput = {
      task,
      payload: { project: { id: 123 }, object_attributes: { id: 100 }, __subType: 'commented' },
      repo,
      robot,
      robotsInRepo: [robot],
      gitlab
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain('Issue=5 Id=100 Body=content from id');
  });

  test('merge_request created：可通过 mergeRequest.* 插入 MR/PR 内容区块', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const task: Task = {
      ...baseTask(),
      eventType: 'merge_request',
      repoProvider: 'gitlab',
      promptCustom: [
        'MR={{mergeRequest.number}} {{mergeRequest.title}}',
        'URL={{mergeRequest.url}}',
        'Branches={{mergeRequest.sourceBranch}} -> {{mergeRequest.targetBranch}}',
        'Body={{mergeRequest.body}}'
      ].join('\n\n')
    };

    const input: BuildPromptInput = {
      task,
      payload: {
        __subType: 'created',
        object_attributes: {
          id: 200,
          iid: 3,
          title: 'demo mr',
          description: 'mr desc',
          web_url: 'http://example.com/mr/3',
          source_branch: 'feat/a',
          target_branch: 'main'
        }
      },
      repo,
      robot,
      robotsInRepo: [robot]
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain('MR=3 demo mr');
    expect(ctx.body).toContain('URL=http://example.com/mr/3');
    expect(ctx.body).toContain('Branches=feat/a -> main');
    expect(ctx.body).toContain('Body=mr desc');
    expect(ctx.body).not.toContain('角色：');
  });

  test('Issue 评论：支持 comment.context.* 变量，且不会重复追加固定区块', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const task: Task = {
      ...baseTask(),
      eventType: 'issue',
      issueId: 5,
      repoProvider: 'gitlab',
      promptCustom: ['BEGIN', '{{comment.context.current}}', '{{comment.context.history}}', 'END'].join('\n\n')
    };

    const gitlab = {
      getIssue: jest.fn().mockResolvedValue({
        id: 100,
        iid: 5,
        title: '加入触发器的 issue',
        description: '加入触发器的 issue',
        state: 'opened',
        web_url: 'http://example.com/issues/5'
      }),
      listIssueNotes: jest.fn().mockResolvedValue([
        {
          id: 200,
          body: 'current 1',
          created_at: iso,
          discussion_id: 'd1',
          author: { id: 1, username: 'root', name: 'root' }
        },
        {
          id: 201,
          body: 'reply 1',
          created_at: iso,
          discussion_id: 'd1',
          author: { id: 2, username: 'alice', name: 'alice' }
        },
        {
          id: 202,
          body: 'old comment',
          created_at: iso,
          discussion_id: 'd2',
          author: { id: 3, username: 'bob', name: 'bob' }
        },
        {
          id: 203,
          body: 'bot comment',
          created_at: iso,
          discussion_id: 'd2',
          author: { id: 4, username: 'hookcode-review', name: 'hookcode-review' }
        }
      ])
    } as any;

    const input: BuildPromptInput = {
      task,
      payload: {
        project: { id: 123 },
        __subType: 'commented',
        object_attributes: { id: 200, discussion_id: 'd1', note: 'pls check' },
        user: { username: 'root' }
      },
      repo,
      robot,
      robotsInRepo: [robot],
      gitlab
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain('BEGIN');
    expect(ctx.body).toContain('END');
    expect(ctx.body).toContain('root: current 1');
    expect(ctx.body).toContain('alice: reply 1');
    expect(ctx.body).toContain('bob: old comment');
    expect(ctx.body).not.toContain('bot comment');
  });

  test('commit commented：支持 comment.context.current/history 变量（过滤机器人自身评论）', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const task: Task = {
      ...baseTask(),
      eventType: 'commit',
      repoProvider: 'gitlab',
      promptCustom: ['BEGIN', '{{comment.context.current}}', '{{comment.context.history}}', 'END'].join('\n\n')
    };

    const gitlab = {
      listCommitComments: jest.fn().mockResolvedValue([
        {
          id: 200,
          note: 'pls check',
          created_at: iso,
          author: { id: 1, username: 'root', name: 'root' }
        },
        {
          id: 201,
          note: 'old comment',
          created_at: iso,
          author: { id: 2, username: 'bob', name: 'bob' }
        },
        {
          id: 202,
          note: 'bot comment',
          created_at: iso,
          author: { id: 3, username: 'hookcode-review', name: 'hookcode-review' }
        }
      ])
    } as any;

    const input: BuildPromptInput = {
      task,
      payload: {
        project: { id: 123 },
        __subType: 'commented',
        object_attributes: { id: 200, note: 'pls check', commit_id: 'sha-1' },
        user: { username: 'root' }
      },
      repo,
      robot,
      robotsInRepo: [robot],
      gitlab
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain('BEGIN');
    expect(ctx.body).toContain('END');
    expect(ctx.body).toContain('root: pls check');
    expect(ctx.body).toContain('bob: old comment');
    expect(ctx.body).not.toContain('bot comment');
    expect(ctx.body).not.toContain('角色：');
  });

  test('merge_request commented：支持 comment.context.current/history 变量（过滤机器人自身评论）', async () => {
    const repo = baseRepo();
    const robot = baseRobot();
    const task: Task = {
      ...baseTask(),
      eventType: 'merge_request',
      repoProvider: 'gitlab',
      promptCustom: ['BEGIN', '{{comment.context.current}}', '{{comment.context.history}}', 'END'].join('\n\n')
    };

    const gitlab = {
      listMergeRequestNotes: jest.fn().mockResolvedValue([
        {
          id: 300,
          body: 'LGTM?',
          created_at: iso,
          discussion_id: 'd1',
          author: { id: 1, username: 'alice', name: 'alice' }
        },
        {
          id: 301,
          body: 'bot comment',
          created_at: iso,
          discussion_id: 'd2',
          author: { id: 2, username: 'hookcode-review', name: 'hookcode-review' }
        },
        {
          id: 302,
          body: 'old comment',
          created_at: iso,
          discussion_id: 'd2',
          author: { id: 3, username: 'bob', name: 'bob' }
        }
      ])
    } as any;

    const input: BuildPromptInput = {
      task,
      payload: {
        project: { id: 123 },
        __subType: 'commented',
        merge_request: { iid: 3 },
        object_attributes: { id: 300, discussion_id: 'd1', note: 'LGTM?' },
        user: { username: 'alice' }
      },
      repo,
      robot,
      robotsInRepo: [robot],
      gitlab
    };

    const ctx = await buildPrompt(input);
    expect(ctx.body).toContain('BEGIN');
    expect(ctx.body).toContain('END');
    expect(ctx.body).toContain('alice: LGTM?');
    expect(ctx.body).toContain('bob: old comment');
    expect(ctx.body).not.toContain('bot comment');
    expect(ctx.body).not.toContain('角色：');
  });
});
