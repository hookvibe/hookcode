import {
  mergeGeminiCliRobotProviderConfig,
  normalizeGeminiCliRobotProviderConfig,
  toPublicGeminiCliRobotProviderConfig
} from '../../modelProviders/geminiCli';

describe('gemini_cli provider config', () => {
  test('normalizeGeminiCliRobotProviderConfig 默认值完整', () => {
    const cfg = normalizeGeminiCliRobotProviderConfig(null);
    expect(cfg.credentialSource).toBe('user');
    expect(cfg.model).toBeTruthy();
    expect(cfg.sandbox).toBe('read-only');
    expect(cfg.sandbox_workspace_write.network_access).toBe(false);
  });

  test('mergeGeminiCliRobotProviderConfig 在未提供 apiKey 时保留旧 apiKey', () => {
    const existing = {
      credentialSource: 'robot',
      credential: { apiKey: 'key-1' },
      model: 'gemini-2.5-pro',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };
    const next = {
      credentialSource: 'robot',
      credential: {},
      model: 'gemini-2.5-flash',
      sandbox: 'workspace-write',
      sandbox_workspace_write: { network_access: true }
    };

    const merged = mergeGeminiCliRobotProviderConfig({ existing, next });
    expect(merged.credential?.apiKey).toBe('key-1');
    expect(merged.model).toBe('gemini-2.5-flash');
  });

  test('mergeGeminiCliRobotProviderConfig 在 credentialSource!=robot 时移除 embedded credential', () => {
    const existing = {
      credentialSource: 'robot',
      credential: { apiKey: 'key-1' },
      model: 'gemini-2.5-pro',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };
    const next = {
      credentialSource: 'user',
      credential: { apiKey: 'should-be-dropped' },
      model: 'gemini-2.5-pro',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };

    const merged = mergeGeminiCliRobotProviderConfig({ existing, next });
    expect(merged.credentialSource).toBe('user');
    expect(merged.credential).toBeUndefined();
  });

  test('toPublicGeminiCliRobotProviderConfig 会脱敏 apiKey 并给出 hasApiKey', () => {
    const cfg = {
      credentialSource: 'robot',
      credential: { apiKey: 'key-1' },
      model: 'gemini-2.5-pro',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };

    const pub = toPublicGeminiCliRobotProviderConfig(cfg) as any;
    expect(pub.credential?.apiKey).toBeUndefined();
    expect(pub.credential?.hasApiKey).toBe(true);
  });
});

