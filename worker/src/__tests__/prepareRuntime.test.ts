// Verify worker package-manager detection stays deterministic after switching probes to cross-platform spawn helpers. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
import { detectNpmCommand } from '../runtime/prepareRuntime';

describe('detectNpmCommand', () => {
  test('prefers pnpm when the probe succeeds', () => {
    const command = detectNpmCommand(() => ({ status: 0, stdout: '', stderr: '' } as any));

    expect(command).toEqual({
      command: 'pnpm',
      args: ['add', '--ignore-workspace', '--save-prod']
    });
  });

  test('falls back to npm when the pnpm probe fails', () => {
    const command = detectNpmCommand(() => ({ status: 1, stdout: '', stderr: '' } as any));

    expect(command).toEqual({
      command: 'npm',
      args: ['install', '--no-save']
    });
  });
});
