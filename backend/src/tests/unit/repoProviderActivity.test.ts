export {};

import { fetchRepoProviderActivity, RepoProviderAuthRequiredError } from '../../services/repoProviderActivity';

// Cover repo provider activity aggregation with mocked provider HTTP calls. kzxac35mxk0fg358i7zs

const jsonResponse = (json: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => json,
    text: async () => JSON.stringify(json)
  } as any);

const errorResponse = (params: { status: number; statusText: string; body?: string }) =>
  Promise.resolve({
    ok: false,
    status: params.status,
    statusText: params.statusText,
    json: async () => ({}),
    text: async () => params.body ?? ''
  } as any);

describe('fetchRepoProviderActivity', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('aggregates gitlab commits/merges/issues', async () => {
    (global as any).fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse([
          {
            id: 'c1',
            short_id: 'c1',
            title: 'feat: one',
            message: 'feat: one\n\nbody',
            web_url: 'https://gitlab.example.com/group/project/-/commit/c1',
            created_at: '2026-01-21T00:00:00.000Z'
          },
          {
            id: 'c2',
            short_id: 'c2',
            title: 'fix: two',
            message: 'fix: two',
            web_url: 'https://gitlab.example.com/group/project/-/commit/c2',
            created_at: '2026-01-20T00:00:00.000Z'
          }
        ])
      )
      .mockImplementationOnce(() =>
        jsonResponse([
          {
            id: 10,
            iid: 2,
            title: 'Merge: feature',
            state: 'merged',
            web_url: 'https://gitlab.example.com/group/project/-/merge_requests/2',
            source_branch: 'feature',
            target_branch: 'main'
          }
        ])
      )
      .mockImplementationOnce(() =>
        jsonResponse([
          {
            id: 20,
            iid: 7,
            title: 'Issue: bug',
            state: 'opened',
            web_url: 'https://gitlab.example.com/group/project/-/issues/7'
          }
        ])
      );

    const res = await fetchRepoProviderActivity({
      provider: 'gitlab',
      repoIdentity: '123',
      token: '',
      apiBaseUrl: 'https://gitlab.example.com',
      limit: 2
    });

    expect(res.commits).toEqual([
      {
        id: 'c1',
        title: 'feat: one',
        url: 'https://gitlab.example.com/group/project/-/commit/c1',
        time: '2026-01-21T00:00:00.000Z'
      },
      {
        id: 'c2',
        title: 'fix: two',
        url: 'https://gitlab.example.com/group/project/-/commit/c2',
        time: '2026-01-20T00:00:00.000Z'
      }
    ]);

    expect(res.merges).toEqual([
      {
        id: '2',
        title: 'Merge: feature',
        url: 'https://gitlab.example.com/group/project/-/merge_requests/2',
        state: 'merged'
      }
    ]);

    expect(res.issues).toEqual([
      {
        id: '7',
        title: 'Issue: bug',
        url: 'https://gitlab.example.com/group/project/-/issues/7',
        state: 'opened'
      }
    ]);
  });

  test('aggregates github commits + merged PRs + issues (filters PR issues)', async () => {
    (global as any).fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse([
          { sha: 's1', html_url: 'https://github.com/o/r/commit/s1', commit: { message: 'fix: one\n\nbody' } },
          { sha: 's2', html_url: 'https://github.com/o/r/commit/s2', commit: { message: 'feat: two' } }
        ])
      )
      .mockImplementationOnce(() =>
        jsonResponse([
          { id: 1, number: 10, title: 'PR merged', state: 'closed', merged_at: '2026-01-20T00:00:00.000Z', html_url: 'https://github.com/o/r/pull/10', updated_at: '2026-01-20T00:00:00.000Z' },
          { id: 2, number: 11, title: 'PR closed', state: 'closed', merged_at: null, html_url: 'https://github.com/o/r/pull/11', updated_at: '2026-01-19T00:00:00.000Z' }
        ])
      )
      .mockImplementationOnce(() =>
        jsonResponse([
          { id: 3, number: 5, title: 'Issue open', state: 'open', html_url: 'https://github.com/o/r/issues/5', updated_at: '2026-01-18T00:00:00.000Z' },
          { id: 4, number: 6, title: 'PR masquerading', state: 'open', html_url: 'https://github.com/o/r/pull/6', pull_request: { url: 'x' }, updated_at: '2026-01-17T00:00:00.000Z' }
        ])
      );

    const res = await fetchRepoProviderActivity({
      provider: 'github',
      repoIdentity: 'o/r',
      token: '',
      apiBaseUrl: 'https://api.github.com',
      limit: 2
    });

    expect(res.commits).toEqual([
      { id: 's1', title: 'fix: one', url: 'https://github.com/o/r/commit/s1' },
      { id: 's2', title: 'feat: two', url: 'https://github.com/o/r/commit/s2' }
    ]);

    expect(res.merges).toEqual([
      { id: '10', title: 'PR merged', url: 'https://github.com/o/r/pull/10', state: 'closed', time: '2026-01-20T00:00:00.000Z' }
    ]);

    expect(res.issues).toEqual([
      { id: '5', title: 'Issue open', url: 'https://github.com/o/r/issues/5', state: 'open', time: '2026-01-18T00:00:00.000Z' }
    ]);
  });

  test('suggests credentials when anonymous provider request returns 404', async () => {
    (global as any).fetch = jest.fn().mockImplementation(() =>
      errorResponse({ status: 404, statusText: 'Not Found', body: 'Not Found' })
    );

    await expect(
      fetchRepoProviderActivity({
        provider: 'github',
        repoIdentity: 'o/r',
        token: '',
        apiBaseUrl: 'https://api.github.com',
        limit: 3
      })
    ).rejects.toBeInstanceOf(RepoProviderAuthRequiredError);
  });
});
