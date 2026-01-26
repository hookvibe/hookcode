import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';

const createTempRepo = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hookcode-config-'));
  return dir;
};

// Validate `.hookcode.yml` parsing for dependency configuration. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
describe('HookcodeConfigService', () => {
  test('parses dependency config with workdir', async () => {
    const repoDir = await createTempRepo();
    try {
      await writeFile(
        path.join(repoDir, '.hookcode.yml'),
        [
          'version: 1',
          'dependency:',
          '  failureMode: soft',
          '  runtimes:',
          '    - language: node',
          '      workdir: backend',
          '      install: "pnpm install --frozen-lockfile"'
        ].join('\n'),
        'utf8'
      );
      const service = new HookcodeConfigService();
      const cfg = await service.parseConfig(repoDir);
      expect(cfg?.dependency?.runtimes[0]?.workdir).toBe('backend');
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test('rejects invalid failureMode', async () => {
    const repoDir = await createTempRepo();
    try {
      await writeFile(
        path.join(repoDir, '.hookcode.yml'),
        ['version: 1', 'dependency:', '  failureMode: maybe', '  runtimes: []'].join('\n'),
        'utf8'
      );
      const service = new HookcodeConfigService();
      await expect(service.parseConfig(repoDir)).rejects.toThrow('Invalid .hookcode.yml');
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });
});
