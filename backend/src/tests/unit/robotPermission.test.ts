import { inferRobotPermission } from '../../services/robotPermission';

describe('robot permission inference', () => {
  test('defaults to read when config is missing', () => {
    expect(inferRobotPermission({})).toBe('read');
  });

  test('maps codex sandbox=read-only to permission=read', () => {
    expect(
      inferRobotPermission({
        modelProvider: 'codex',
        modelProviderConfig: { sandbox: 'read-only' }
      })
    ).toBe('read');
  });

  test('maps codex sandbox=workspace-write to permission=write', () => {
    expect(
      inferRobotPermission({
        modelProvider: 'codex',
        modelProviderConfig: { sandbox: 'workspace-write' }
      })
    ).toBe('write');
  });

  test('maps claude_code sandbox=workspace-write to permission=write', () => {
    expect(
      inferRobotPermission({
        modelProvider: 'claude_code',
        modelProviderConfig: { sandbox: 'workspace-write' }
      })
    ).toBe('write');
  });

  test('maps gemini_cli sandbox=workspace-write to permission=write', () => {
    expect(
      inferRobotPermission({
        modelProvider: 'gemini_cli',
        modelProviderConfig: { sandbox: 'workspace-write' }
      })
    ).toBe('write');
  });

  test('unknown providers fall back to read', () => {
    expect(
      inferRobotPermission({
        modelProvider: 'unknown',
        modelProviderConfig: { sandbox: 'workspace-write' }
      })
    ).toBe('read');
  });
});
