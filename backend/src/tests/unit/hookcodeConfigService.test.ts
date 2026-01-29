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

  test('parses preview config with instances', async () => {
    const repoDir = await createTempRepo();
    try {
      await writeFile(
        path.join(repoDir, '.hookcode.yml'),
        [
          'version: 1',
          'preview:',
          '  instances:',
          '    - name: frontend',
          '      command: \"pnpm dev\"',
          '      workdir: frontend',
          '      port: 5173',
          '      readyPattern: \"Local:\"'
        ].join('\n'),
        'utf8'
      );
      const service = new HookcodeConfigService();
      const cfg = await service.parseConfig(repoDir);
      // Validate preview instance parsing for dev server configs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      expect(cfg?.preview?.instances[0]?.name).toBe('frontend');
      expect(cfg?.preview?.instances[0]?.workdir).toBe('frontend');
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test('rejects duplicate preview instance names', async () => {
    const repoDir = await createTempRepo();
    try {
      await writeFile(
        path.join(repoDir, '.hookcode.yml'),
        [
          'version: 1',
          'preview:',
          '  instances:',
          '    - name: ui',
          '      command: \"pnpm dev\"',
          '      workdir: frontend',
          '    - name: ui',
          '      command: \"pnpm dev\"',
          '      workdir: frontend'
        ].join('\n'),
        'utf8'
      );
      const service = new HookcodeConfigService();
      await expect(service.parseConfig(repoDir)).rejects.toThrow('Invalid .hookcode.yml');
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
