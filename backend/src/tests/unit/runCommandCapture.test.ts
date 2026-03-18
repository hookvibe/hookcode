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
      // Use a Node-based directory listing so the cwd test stays valid on native Windows shells too. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
      const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify("const fs = require('fs'); console.log(fs.readdirSync('.').join('\\n'))")}`;
      const result = await runCommandCapture(command, { cwd: dir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.split(/\r?\n/)).toContain('marker.txt');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
