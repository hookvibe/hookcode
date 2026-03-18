// Cover Windows process-tree termination so backend shutdown helpers do not leave shell-wrapped children running. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

const setPlatform = (value: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value
  });
};

describe('backend cross-platform spawn helpers', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  test('stopChildProcessTree uses taskkill on Windows', () => {
    const execFileSync = jest.fn();
    setPlatform('win32');
    jest.doMock('child_process', () => ({
      spawn: jest.fn(),
      execSync: jest.fn(),
      execFileSync
    }));

    const { stopChildProcessTree } = require('../../utils/crossPlatformSpawn');
    const child = { pid: 456, exitCode: null, signalCode: null, kill: jest.fn() };
    stopChildProcessTree(child, 'SIGTERM');

    expect(execFileSync).toHaveBeenCalledWith(
      'taskkill',
      ['/PID', '456', '/T', '/F'],
      expect.objectContaining({ stdio: 'ignore', windowsHide: true })
    );
    expect(child.kill).not.toHaveBeenCalled();
  });
});
