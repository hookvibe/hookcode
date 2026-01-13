import { buildChatTaskPayload } from '../../services/chatPayload';

describe('buildChatTaskPayload', () => {
  test('gitlab: derives clone/web URLs from apiBaseUrl + repo.name', () => {
    const repo: any = {
      id: 'r1',
      provider: 'gitlab',
      name: 'group/project',
      externalId: '123',
      apiBaseUrl: 'https://gitlab.example.com',
      branches: [{ name: 'main', isDefault: true }],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload: any = buildChatTaskPayload({ repo, text: 'hello', author: 'alice' });
    expect(payload.__subType).toBe('commented');
    expect(payload.__skipProviderPost).toBe(true);
    expect(payload.project.path_with_namespace).toBe('group/project');
    expect(payload.project.git_http_url).toBe('https://gitlab.example.com/group/project.git');
    expect(payload.project.web_url).toBe('https://gitlab.example.com/group/project');
    expect(payload.project.default_branch).toBe('main');
    expect(payload.object_attributes.note).toBe('hello');
    expect(payload.user.username).toBe('alice');
  });

  test('github.com: derives clone/web URLs from api.github.com + owner/repo', () => {
    const repo: any = {
      id: 'r2',
      provider: 'github',
      name: 'owner/repo',
      externalId: 'owner/repo',
      apiBaseUrl: 'https://api.github.com',
      branches: [{ name: 'main', isDefault: true }],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload: any = buildChatTaskPayload({ repo, text: 'hello', author: 'bob' });
    expect(payload.__subType).toBe('commented');
    expect(payload.__skipProviderPost).toBe(true);
    expect(payload.repository.full_name).toBe('owner/repo');
    expect(payload.repository.clone_url).toBe('https://github.com/owner/repo.git');
    expect(payload.repository.html_url).toBe('https://github.com/owner/repo');
    expect(payload.repository.default_branch).toBe('main');
    expect(payload.comment.body).toBe('hello');
    expect(payload.comment.user.login).toBe('bob');
  });

  test('github enterprise: derives clone/web URLs from apiBaseUrl(/api/v3) + owner/repo', () => {
    const repo: any = {
      id: 'r3',
      provider: 'github',
      name: 'owner/repo',
      externalId: 'owner/repo',
      apiBaseUrl: 'https://ghe.example.com/api/v3',
      branches: [],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload: any = buildChatTaskPayload({ repo, text: 'hello' });
    expect(payload.repository.clone_url).toBe('https://ghe.example.com/owner/repo.git');
    expect(payload.repository.html_url).toBe('https://ghe.example.com/owner/repo');
  });
});

