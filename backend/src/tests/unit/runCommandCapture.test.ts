import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { runCommandCapture } from '../../agent/agent';

// Verify runCommandCapture honors explicit cwd for dependency installs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
describe('runCommandCapture', () => {
  test('runs commands in the provided cwd', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hookcode-cwd-'));
    try {
      await writeFile(path.join(dir, 'marker.txt'), 'ok');
      const result = await runCommandCapture('ls', { cwd: dir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.split('\n')).toContain('marker.txt');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
