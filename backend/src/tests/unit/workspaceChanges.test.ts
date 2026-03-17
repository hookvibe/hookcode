import { execFileSync } from 'child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  WORKSPACE_SNAPSHOT_EVENT_TYPE,
  collectWorkspaceChanges,
  createWorkspaceSnapshotLogLine,
  filterWorkspaceChangesAgainstBaseline
} from '../../utils/workspaceChanges';

const runGit = (repoDir: string, args: string[]) => {
  execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' });
};

describe('workspaceChanges utils', () => {
  test('collectWorkspaceChanges keeps repo-relative patch headers for create/update/delete files', async () => {
    // Exercise the repo diff collector against a real git repo so new/delete patch commands stay compatible with worker snapshots. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    const repoDir = await mkdtemp(path.join(tmpdir(), 'hookcode-workspace-changes-'));
    try {
      await mkdir(path.join(repoDir, 'docs'), { recursive: true });
      await writeFile(path.join(repoDir, 'tracked.txt'), 'before\n', 'utf8');
      await writeFile(path.join(repoDir, 'removed.txt'), 'delete me\n', 'utf8');
      runGit(repoDir, ['init', '-q']);
      runGit(repoDir, ['config', 'user.email', 'test@example.com']);
      runGit(repoDir, ['config', 'user.name', 'HookCode Test']);
      runGit(repoDir, ['add', 'tracked.txt', 'removed.txt']);
      runGit(repoDir, ['commit', '-qm', 'initial']);

      await writeFile(path.join(repoDir, 'tracked.txt'), 'after\n', 'utf8');
      await rm(path.join(repoDir, 'removed.txt'));
      await writeFile(path.join(repoDir, 'docs', 'created.txt'), 'brand new\n', 'utf8');

      const snapshot = await collectWorkspaceChanges(repoDir);
      expect(snapshot?.files.map((file) => file.path)).toEqual(['docs/created.txt', 'removed.txt', 'tracked.txt']);

      const created = snapshot?.files.find((file) => file.path === 'docs/created.txt');
      const removed = snapshot?.files.find((file) => file.path === 'removed.txt');
      const updated = snapshot?.files.find((file) => file.path === 'tracked.txt');

      expect(created).toEqual(
        expect.objectContaining({
          kind: 'create',
          oldText: undefined,
          newText: 'brand new\n'
        })
      );
      expect(created?.unifiedDiff).toContain('diff --git a/docs/created.txt b/docs/created.txt');
      expect(created?.unifiedDiff).toContain('+++ b/docs/created.txt');
      expect(created?.unifiedDiff.includes(repoDir)).toBe(false);

      expect(removed).toEqual(
        expect.objectContaining({
          kind: 'delete',
          oldText: 'delete me\n',
          newText: undefined
        })
      );
      expect(removed?.unifiedDiff).toContain('diff --git a/removed.txt b/removed.txt');
      expect(removed?.unifiedDiff).toContain('+++ /dev/null');

      expect(updated).toEqual(
        expect.objectContaining({
          kind: 'update',
          oldText: 'before\n',
          newText: 'after\n'
        })
      );
      expect(updated?.unifiedDiff).toContain('diff --git a/tracked.txt b/tracked.txt');
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test('filters snapshots against a baseline and serializes snapshot log lines', () => {
    const baseline = {
      capturedAt: '2026-03-16T09:00:00.000Z',
      files: [{ path: 'same.ts', unifiedDiff: 'same', diffHash: 'same-hash', updatedAt: '2026-03-16T09:00:00.000Z' }]
    };
    const snapshot = {
      capturedAt: '2026-03-16T09:01:00.000Z',
      files: [
        { path: 'same.ts', unifiedDiff: 'same', diffHash: 'same-hash', updatedAt: '2026-03-16T09:01:00.000Z' },
        { path: 'next.ts', kind: 'update' as const, unifiedDiff: 'diff', diffHash: 'next-hash', updatedAt: '2026-03-16T09:01:00.000Z' }
      ]
    };

    const filtered = filterWorkspaceChangesAgainstBaseline(snapshot, baseline);
    expect(filtered).toEqual({
      capturedAt: '2026-03-16T09:01:00.000Z',
      files: [snapshot.files[1]]
    });

    const line = createWorkspaceSnapshotLogLine(filtered);
    expect(JSON.parse(line)).toEqual({
      type: WORKSPACE_SNAPSHOT_EVENT_TYPE,
      snapshot: filtered
    });
  });
});
