describe('GitlabService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    process.env = originalEnv;
  });

  test('baseUrl 允许包含 /api/v4（避免双重拼接）', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ id: 1, iid: 1, title: 't', state: 'opened', web_url: 'https://example.com' }),
      text: async () => ''
    });
    (global as any).fetch = fetchMock;

    const { GitlabService } = require('../../services/gitlabService');
    const client = new GitlabService({ token: 't', baseUrl: 'https://gitlab.example.com/api/v4' });

    await client.getIssue(123, 1);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://gitlab.example.com/api/v4/projects/123/issues/1',
      expect.any(Object)
    );
  });

  test('baseUrl 允许 GitLab 子路径 + /api/v4（避免双重拼接）', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ id: 1, iid: 1, title: 't', state: 'opened', web_url: 'https://example.com' }),
      text: async () => ''
    });
    (global as any).fetch = fetchMock;

    const { GitlabService } = require('../../services/gitlabService');
    const client = new GitlabService({ token: 't', baseUrl: 'https://example.com/gitlab/api/v4/' });

    await client.getIssue(123, 1);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/gitlab/api/v4/projects/123/issues/1',
      expect.any(Object)
    );
  });

  test('错误信息应包含 method + url（便于定位 404 原因）', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '{"message":"404 Not found"}'
    });
    (global as any).fetch = fetchMock;

    const { GitlabService } = require('../../services/gitlabService');
    const client = new GitlabService({ token: 't', baseUrl: 'https://gitlab.example.com/api/v4' });

    await expect(client.getIssue(123, 1)).rejects.toThrow(
      '(GET https://gitlab.example.com/api/v4/projects/123/issues/1)'
    );
  });
});
