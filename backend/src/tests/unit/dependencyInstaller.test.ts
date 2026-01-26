import type { HookcodeConfig } from '../../types/dependency';
import { installDependencies, DependencyInstallerError } from '../../agent/dependencyInstaller';

class FakeRuntimeService {
  constructor(private readonly available: Set<string>) {}
  hasRuntime(language: string): boolean {
    return this.available.has(language);
  }
}

// Exercise dependency installation flow for multi-subproject configs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
describe('dependencyInstaller', () => {
  test('runs installs for multiple workdirs', async () => {
    const calls: Array<{ cwd: string; command: string }> = [];
    const config: HookcodeConfig = {
      version: 1,
      dependency: {
        failureMode: 'soft',
        runtimes: [
          { language: 'node', workdir: 'backend', install: 'pnpm install --frozen-lockfile' },
          { language: 'node', workdir: 'frontend', install: 'pnpm install --frozen-lockfile' }
        ]
      }
    };

    const result = await installDependencies({
      workspaceDir: '/repo',
      config,
      runtimeService: new FakeRuntimeService(new Set(['node'])) as any,
      appendLog: async () => undefined,
      runCommand: async ({ command, cwd }) => {
        calls.push({ command, cwd });
        return { exitCode: 0, output: '' };
      }
    });

    expect(result.status).toBe('success');
    expect(calls).toEqual([
      { cwd: '/repo/backend', command: 'pnpm install --frozen-lockfile' },
      { cwd: '/repo/frontend', command: 'pnpm install --frozen-lockfile' }
    ]);
  });

  test('throws when runtime missing in hard mode', async () => {
    const config: HookcodeConfig = {
      version: 1,
      dependency: {
        failureMode: 'hard',
        runtimes: [{ language: 'python', install: 'pip install -r requirements.txt' }]
      }
    };

    await expect(
      installDependencies({
        workspaceDir: '/repo',
        config,
        runtimeService: new FakeRuntimeService(new Set()) as any,
        appendLog: async () => undefined,
        runCommand: async () => ({ exitCode: 0, output: '' })
      })
    ).rejects.toBeInstanceOf(DependencyInstallerError);
  });
});
