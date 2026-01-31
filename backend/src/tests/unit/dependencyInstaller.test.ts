import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
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

  // Guard against pnpm walking up to the parent HookCode workspace. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  test('appends --ignore-workspace when parent pnpm-workspace.yaml exists', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'hookcode-pnpm-parent-'));
    const workspaceDir = path.join(root, 'repo');
    try {
      await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, 'package.json'), '{"name":"repo","version":"0.0.0"}\n', 'utf8');
      const calls: Array<{ cwd: string; command: string }> = [];
      const config: HookcodeConfig = {
        version: 1,
        dependency: {
          failureMode: 'soft',
          runtimes: [{ language: 'node', install: 'pnpm install --frozen-lockfile' }]
        }
      };

      await installDependencies({
        workspaceDir,
        config,
        runtimeService: new FakeRuntimeService(new Set(['node'])) as any,
        appendLog: async () => undefined,
        runCommand: async ({ command, cwd }) => {
          calls.push({ command, cwd });
          return { exitCode: 0, output: '' };
        }
      });

      expect(calls[0]?.command).toBe('pnpm install --frozen-lockfile --ignore-workspace');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // Preserve pnpm workspace installs when the repo defines its own workspace file. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  test('keeps pnpm workspace installs when pnpm-workspace.yaml is inside repo', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'hookcode-pnpm-local-'));
    const workspaceDir = path.join(root, 'repo');
    try {
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');
      await writeFile(path.join(workspaceDir, 'package.json'), '{"name":"repo","version":"0.0.0"}\n', 'utf8');
      const calls: Array<{ cwd: string; command: string }> = [];
      const config: HookcodeConfig = {
        version: 1,
        dependency: {
          failureMode: 'soft',
          runtimes: [{ language: 'node', install: 'pnpm install --frozen-lockfile' }]
        }
      };

      await installDependencies({
        workspaceDir,
        config,
        runtimeService: new FakeRuntimeService(new Set(['node'])) as any,
        appendLog: async () => undefined,
        runCommand: async ({ command, cwd }) => {
          calls.push({ command, cwd });
          return { exitCode: 0, output: '' };
        }
      });

      expect(calls[0]?.command).toBe('pnpm install --frozen-lockfile');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
