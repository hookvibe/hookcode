import {
  buildCodexSdkThreadOptions,
  mergeCodexRobotProviderConfig,
  normalizeCodexApiBaseUrl,
  normalizeCodexRobotProviderConfig,
  toPublicCodexRobotProviderConfig
} from '../../modelProviders/codex';

describe('codex provider config', () => {
  test('normalizeCodexRobotProviderConfig 默认值完整', () => {
    const cfg = normalizeCodexRobotProviderConfig(null);
    expect(cfg.credentialSource).toBe('user');
    expect(cfg.model).toBe('gpt-5.1-codex-max');
    expect(cfg.sandbox).toBe('read-only');
    // Codex config no longer exposes network access toggles. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
    expect(cfg.model_reasoning_effort).toBe('medium');
  });

  test('mergeCodexRobotProviderConfig 在未提供 apiKey 时保留旧 apiKey', () => {
    const existing = {
      credentialSource: 'robot',
      credential: { apiBaseUrl: 'https://a.example', apiKey: 'key-1' },
      model: 'gpt-5.2',
      sandbox: 'read-only',
      // Codex config no longer persists network access settings. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
      model_reasoning_effort: 'low'
    };
    const next = {
      credentialSource: 'robot',
      credential: { apiBaseUrl: 'https://b.example' },
      model: 'gpt-5.1-codex-mini',
      sandbox: 'workspace-write',
      // Codex config no longer persists network access settings. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
      model_reasoning_effort: 'high'
    };

    const merged = mergeCodexRobotProviderConfig({ existing, next });
    expect(merged.credential?.apiBaseUrl).toBe('https://b.example');
    expect(merged.credential?.apiKey).toBe('key-1');
  });

  test('toPublicCodexRobotProviderConfig 会脱敏 apiKey 并给出 hasApiKey', () => {
    const cfg = {
      credentialSource: 'robot',
      credential: { apiBaseUrl: 'https://a.example', apiKey: 'key-1' },
      model: 'gpt-5.2',
      sandbox: 'read-only',
      // Codex config no longer exposes network access toggles. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
      model_reasoning_effort: 'low'
    };

    const pub = toPublicCodexRobotProviderConfig(cfg) as any;
    expect(pub.credential?.apiKey).toBeUndefined();
    expect(pub.credential?.hasApiKey).toBe(true);
  });

  test('buildCodexSdkThreadOptions 可生成 thread options（read-only）', () => {
    const opts = buildCodexSdkThreadOptions({
      repoDir: '/repo',
      model: 'gpt-5.2',
      sandbox: 'read-only',
      // Codex thread options always enable network access. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
      modelReasoningEffort: 'high'
    });

    expect(opts.model).toBe('gpt-5.2');
    expect(opts.sandboxMode).toBe('read-only');
    expect(opts.workingDirectory).toBe('/repo');
    expect(opts.skipGitRepoCheck).toBe(true);
    expect(opts.approvalPolicy).toBe('never');
    expect(opts.modelReasoningEffort).toBe('high');
    expect(opts.networkAccessEnabled).toBe(true);
    expect(opts.additionalDirectories).toBeUndefined();
  });

  test('buildCodexSdkThreadOptions 在 sandbox=workspace-write 时追加 .git 目录', () => {
    const opts = buildCodexSdkThreadOptions({
      repoDir: '/repo',
      model: 'gpt-5.1-codex-max',
      sandbox: 'workspace-write',
      // Codex thread options always enable network access. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
      modelReasoningEffort: 'medium'
    });
    expect(opts.sandboxMode).toBe('workspace-write');
    expect(opts.additionalDirectories).toEqual(['/repo/.git']);
  });

  test('normalizeCodexApiBaseUrl 在未设置时返回 undefined', () => {
    expect(normalizeCodexApiBaseUrl('')).toBeUndefined();
    expect(normalizeCodexApiBaseUrl('   ')).toBeUndefined();
  });

  test('normalizeCodexApiBaseUrl 会忽略非法 apiBaseUrl（避免注入/凭据泄露）', () => {
    expect(normalizeCodexApiBaseUrl("https://right.codes/codex/v1' && echo pwned && '")).toBeUndefined();
    expect(normalizeCodexApiBaseUrl('https://user:pass@right.codes/codex/v1')).toBeUndefined();
    expect(normalizeCodexApiBaseUrl('https://right.codes/codex/v1')).toBe('https://right.codes/codex/v1');
  });
});
