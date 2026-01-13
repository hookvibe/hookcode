import { __test__buildGithubTaskMeta, __test__buildTaskMeta } from '../../modules/webhook/webhook.handlers';

describe('buildTaskMeta (gitlab automation)', () => {
  test('Note Hook（issue commented）应使用 payload.issue.iid，而不是 note.id', () => {
    const payload = {
      __subType: 'commented',
      project: { id: 25 },
      // GitLab Note Hook: object_attributes is note.
      object_attributes: { id: 397, noteable_type: 'Issue' },
      issue: { id: 9999, iid: 12, title: 'demo issue' }
    };

    const meta = __test__buildTaskMeta('issue', payload);

    expect(meta.projectId).toBe(25);
    expect(meta.issueId).toBe(12);
  });

  test('Note Hook（mr commented）应使用 payload.merge_request.iid，而不是 note.id', () => {
    const payload = {
      __subType: 'commented',
      project: { id: 25 },
      object_attributes: { id: 401, noteable_type: 'MergeRequest' },
      merge_request: { id: 8888, iid: 3, title: 'demo mr' }
    };

    const meta = __test__buildTaskMeta('merge_request', payload);

    expect(meta.projectId).toBe(25);
    expect(meta.mrId).toBe(3);
    expect(meta.ref).toBeUndefined();
  });

  test('Push Hook（commit created）标题应包含最新 commit 的 message 摘要', () => {
    const payload = {
      __subType: 'created',
      project: { id: 25, path_with_namespace: 'group/repo' },
      ref: 'refs/heads/main',
      after: 'b'.repeat(40),
      commits: [
        { id: 'a'.repeat(40), message: 'feat: first\n\nbody' },
        { id: 'b'.repeat(40), message: 'fix: second\n\nmore' }
      ]
    };

    const meta = __test__buildTaskMeta('commit', payload);

    expect(meta.title).toContain('fix: second');
    expect(meta.ref).toBe('refs/heads/main');
  });

  test('GitHub push（commit created）标题应包含 head_commit.message 摘要', () => {
    const payload = {
      __subType: 'created',
      repository: { id: 99, full_name: 'owner/repo' },
      ref: 'refs/heads/main',
      head_commit: { message: 'feat: hello\n\nbody' }
    };

    const meta = __test__buildGithubTaskMeta('commit', payload);

    expect(meta.title).toContain('feat: hello');
    expect(meta.ref).toBe('refs/heads/main');
  });
});
