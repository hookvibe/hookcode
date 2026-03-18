// Validate worker cross-platform spawn helpers so Windows command probing and cancellation stay stable. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

const setPlatform = (value: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value
  });
};

describe('worker cross-platform spawn helpers', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  test('xSpawnSync injects shell=true for Windows command probes', () => {
    const spawnSync = jest.fn().mockReturnValue({ status: 0, stdout: '', stderr: '' });
    const execFileSync = jest.fn();
    setPlatform('win32');
    jest.doMock('child_process', () => ({
      spawn: jest.fn(),
      spawnSync,
      execFileSync
    }));

    const { xSpawnSync } = require('../runtime/crossPlatformSpawn');
    xSpawnSync('pnpm', ['--version'], { stdio: 'ignore' });

    expect(spawnSync).toHaveBeenCalledWith('pnpm', ['--version'], expect.objectContaining({ shell: true, stdio: 'ignore' }));
  });

  test('stopChildProcessTree uses taskkill on Windows before falling back to child.kill', () => {
    const execFileSync = jest.fn();
    setPlatform('win32');
    jest.doMock('child_process', () => ({
      spawn: jest.fn(),
      spawnSync: jest.fn(),
      execFileSync
    }));

    const { stopChildProcessTree } = require('../runtime/crossPlatformSpawn');
    const child = { pid: 321, exitCode: null, signalCode: null, kill: jest.fn() };
    stopChildProcessTree(child, 'SIGTERM');

    expect(execFileSync).toHaveBeenCalledWith(
      'taskkill',
      ['/PID', '321', '/T', '/F'],
      expect.objectContaining({ stdio: 'ignore', windowsHide: true })
    );
    expect(child.kill).not.toHaveBeenCalled();
  });
});
