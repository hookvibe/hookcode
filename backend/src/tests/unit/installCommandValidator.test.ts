import { validateInstallCommand } from '../../services/installCommandValidator';

// Validate install command allowlists and safety rules. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
describe('installCommandValidator', () => {
  test('accepts allowed npm/pnpm install commands', () => {
    expect(validateInstallCommand('node', 'pnpm install --frozen-lockfile').valid).toBe(true);
    expect(validateInstallCommand('node', 'npm ci').valid).toBe(true);
  });

  test('blocks dangerous shell characters', () => {
    const result = validateInstallCommand('python', 'pip install -r requirements.txt && rm -rf /');
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('blocked_chars');
  });

  test('allows custom commands only when enabled', () => {
    const blocked = validateInstallCommand('java', 'mvn clean install');
    expect(blocked.valid).toBe(false);
    const allowed = validateInstallCommand('java', 'mvn clean install', { allowCustomInstall: true });
    expect(allowed.valid).toBe(true);
  });
});
