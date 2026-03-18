export {};

import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  cleanupStaleQueryEngineTemps,
  shouldRetryGenerateAfterEngineRenameLock
} = require('../../../scripts/prisma-run.js');

describe('prisma-run windows retry helpers', () => {
  test('retries Windows generate when Prisma hits a query engine rename lock', () => {
    // Recognize transient Windows Prisma rename locks so backend pretest can retry instead of failing the whole suite immediately. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const output =
      "Error:\nEPERM: operation not permitted, rename 'C:\\repo\\query_engine-windows.dll.node.tmp46020' -> 'C:\\repo\\query_engine-windows.dll.node'";

    expect(
      shouldRetryGenerateAfterEngineRenameLock({
        platform: 'win32',
        command: 'generate',
        output,
        attempt: 1,
        maxAttempts: 3
      })
    ).toBe(true);
    expect(
      shouldRetryGenerateAfterEngineRenameLock({
        platform: 'win32',
        command: 'migrate',
        output,
        attempt: 1,
        maxAttempts: 3
      })
    ).toBe(false);
    expect(
      shouldRetryGenerateAfterEngineRenameLock({
        platform: 'linux',
        command: 'generate',
        output,
        attempt: 1,
        maxAttempts: 3
      })
    ).toBe(false);
  });

  test('removes stale Windows query engine temp files between retries', () => {
    // Clean leftover Prisma temp DLLs so repeated Windows generate retries do not accumulate stale query_engine temp files. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const generatedClientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookcode-prisma-run-'));
    const staleTemp = path.join(generatedClientDir, 'query_engine-windows.dll.node.tmp46020');
    const liveDll = path.join(generatedClientDir, 'query_engine-windows.dll.node');
    const otherFile = path.join(generatedClientDir, 'keep-me.txt');

    try {
      fs.writeFileSync(staleTemp, 'temp');
      fs.writeFileSync(liveDll, 'live');
      fs.writeFileSync(otherFile, 'keep');

      expect(cleanupStaleQueryEngineTemps(generatedClientDir)).toBe(1);
      expect(fs.existsSync(staleTemp)).toBe(false);
      expect(fs.existsSync(liveDll)).toBe(true);
      expect(fs.existsSync(otherFile)).toBe(true);
    } finally {
      fs.rmSync(generatedClientDir, { recursive: true, force: true });
    }
  });
});
