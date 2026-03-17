import { execFileSync } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { RepoChangeTracker } from '../runtime/repoChangeTracker';

const runGit = (repoDir: string, args: string[]) => {
  execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' });
};

describe('RepoChangeTracker', () => {
  test('emits repo-relative workspace snapshots for newly created files', async () => {
    // Verify the worker-side tracker streams the same repo-relative patch format that task views expect from backend snapshots. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const repoDir = await mkdtemp(path.join(tmpdir(), 'hookcode-worker-repo-change-'));
    const emitted: string[] = [];
    const patched: Array<any> = [];

    try {
      await writeFile(path.join(repoDir, 'tracked.txt'), 'stable\n', 'utf8');
      runGit(repoDir, ['init', '-q']);
      runGit(repoDir, ['config', 'user.email', 'test@example.com']);
      runGit(repoDir, ['config', 'user.name', 'HookCode Test']);
      runGit(repoDir, ['add', 'tracked.txt']);
      runGit(repoDir, ['commit', '-qm', 'initial']);

      const tracker = new RepoChangeTracker({
        repoDir,
        emitLine: (line) => emitted.push(line),
        patchSnapshot: async (snapshot) => {
          patched.push(snapshot);
        },
        pollIntervalMs: 10_000
      });

      await tracker.start();
      await writeFile(path.join(repoDir, 'new-file.ts'), 'export const value = 1;\n', 'utf8');
      await tracker.stop();

      expect(patched).toHaveLength(1);
      expect(patched[0]).toEqual(
        expect.objectContaining({
          files: [
            expect.objectContaining({
              path: 'new-file.ts',
              kind: 'create',
              newText: 'export const value = 1;\n'
            })
          ]
        })
      );
      expect(patched[0]?.files?.[0]?.unifiedDiff).toContain('diff --git a/new-file.ts b/new-file.ts');
      expect(patched[0]?.files?.[0]?.unifiedDiff).toContain('+++ b/new-file.ts');
      expect(patched[0]?.files?.[0]?.unifiedDiff.includes(repoDir)).toBe(false);

      expect(emitted).toHaveLength(1);
      expect(JSON.parse(emitted[0])).toEqual({
        type: 'hookcode.workspace.snapshot',
        snapshot: patched[0]
      });
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });
});
