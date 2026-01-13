describe('GithubService', () => {
  test('仅导入模块不应产生 token 未配置的 warn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    jest.isolateModules(() => {
      require('../../services/githubService');
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('未配置 token 时应提示 warn（便于定位配置问题）', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { GithubService } = require('../../services/githubService');

    new GithubService({ token: '' });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[github] token is not configured'));
    warnSpy.mockRestore();
  });

  test('配置 token 时不应产生 warn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { GithubService } = require('../../services/githubService');

    new GithubService({ token: 'test-token' });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
