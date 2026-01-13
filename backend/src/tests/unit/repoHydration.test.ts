import { buildRepoHydrationPatch } from '../../services/repoHydration';

describe('buildRepoHydrationPatch', () => {
  test('GitLab：从 project.id + web_url 回填 externalId/apiBaseUrl', () => {
    const patch = buildRepoHydrationPatch(
      'gitlab',
      { name: 'group/project', externalId: null, apiBaseUrl: null, branches: null },
      { project: { id: 123, web_url: 'https://gitlab.example.com/group/project' } }
    );
    expect(patch).toEqual({ externalId: '123', apiBaseUrl: 'https://gitlab.example.com' });
  });

  test('GitLab：当 name 缺少 namespace 时，从 payload 回填完整 name', () => {
    const patch = buildRepoHydrationPatch(
      'gitlab',
      { name: 'project', externalId: null, apiBaseUrl: null, branches: null },
      { project: { id: 123, web_url: 'https://gitlab.example.com/group/project' } }
    );
    expect(patch).toEqual({ name: 'group/project', externalId: '123', apiBaseUrl: 'https://gitlab.example.com' });
  });

  test('GitLab：从 project.default_branch 回填默认分支', () => {
    const patch = buildRepoHydrationPatch(
      'gitlab',
      { name: 'group/project', externalId: null, apiBaseUrl: null, branches: null },
      { project: { id: 123, web_url: 'https://gitlab.example.com/group/project', default_branch: 'main' } }
    );
    expect(patch).toEqual({
      externalId: '123',
      apiBaseUrl: 'https://gitlab.example.com',
      branches: [{ name: 'main', note: '默认分支（自动回填）', isDefault: true }]
    });
  });

  test('GitHub：github.com 回填 api.github.com', () => {
    const patch = buildRepoHydrationPatch(
      'github',
      { name: 'octo/demo', externalId: undefined, apiBaseUrl: undefined, branches: undefined },
      { repository: { full_name: 'octo/demo', html_url: 'https://github.com/octo/demo' } }
    );
    expect(patch).toEqual({ externalId: 'octo/demo', apiBaseUrl: 'https://api.github.com' });
  });

  test('GitHub Enterprise：回填 origin + /api/v3', () => {
    const patch = buildRepoHydrationPatch(
      'github',
      { name: 'org/repo', externalId: undefined, apiBaseUrl: undefined, branches: undefined },
      { repository: { full_name: 'org/repo', html_url: 'https://github.company.com/org/repo' } }
    );
    expect(patch).toEqual({ externalId: 'org/repo', apiBaseUrl: 'https://github.company.com/api/v3' });
  });

  test('已有配置不覆盖（返回空 patch）', () => {
    const patch = buildRepoHydrationPatch(
      'gitlab',
      {
        name: 'group/project',
        externalId: '999',
        apiBaseUrl: 'https://gitlab.local',
        branches: [{ name: 'main', note: '主分支', isDefault: true }]
      },
      { project: { id: 123, web_url: 'https://gitlab.example.com/group/project' } }
    );
    expect(patch).toEqual({});
  });
});
