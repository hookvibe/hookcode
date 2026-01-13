import {
  mergeClaudeCodeRobotProviderConfig,
  normalizeClaudeCodeRobotProviderConfig,
  toPublicClaudeCodeRobotProviderConfig
} from '../../modelProviders/claudeCode';

describe('claude_code provider config', () => {
  test('normalizeClaudeCodeRobotProviderConfig 默认值完整', () => {
    const cfg = normalizeClaudeCodeRobotProviderConfig(null);
    expect(cfg.credentialSource).toBe('user');
    expect(cfg.model).toBeTruthy();
    expect(cfg.sandbox).toBe('read-only');
    expect(cfg.sandbox_workspace_write.network_access).toBe(false);
  });

  test('mergeClaudeCodeRobotProviderConfig 在未提供 apiKey 时保留旧 apiKey', () => {
    const existing = {
      credentialSource: 'robot',
      credential: { apiKey: 'key-1' },
      model: 'claude-sonnet-4-5-20250929',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };
    const next = {
      credentialSource: 'robot',
      credential: {},
      model: 'claude-opus-4-20250929',
      sandbox: 'workspace-write',
      sandbox_workspace_write: { network_access: true }
    };

    const merged = mergeClaudeCodeRobotProviderConfig({ existing, next });
    expect(merged.credential?.apiKey).toBe('key-1');
    expect(merged.model).toBe('claude-opus-4-20250929');
  });

  test('mergeClaudeCodeRobotProviderConfig 在 credentialSource!=robot 时移除 embedded credential', () => {
    const existing = {
      credentialSource: 'robot',
      credential: { apiKey: 'key-1' },
      model: 'claude-sonnet-4-5-20250929',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };
    const next = {
      credentialSource: 'user',
      credential: { apiKey: 'should-be-dropped' },
      model: 'claude-sonnet-4-5-20250929',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };

    const merged = mergeClaudeCodeRobotProviderConfig({ existing, next });
    expect(merged.credentialSource).toBe('user');
    expect(merged.credential).toBeUndefined();
  });

  test('toPublicClaudeCodeRobotProviderConfig 会脱敏 apiKey 并给出 hasApiKey', () => {
    const cfg = {
      credentialSource: 'robot',
      credential: { apiKey: 'key-1' },
      model: 'claude-sonnet-4-5-20250929',
      sandbox: 'read-only',
      sandbox_workspace_write: { network_access: false }
    };

    const pub = toPublicClaudeCodeRobotProviderConfig(cfg) as any;
    expect(pub.credential?.apiKey).toBeUndefined();
    expect(pub.credential?.hasApiKey).toBe(true);
  });
});

