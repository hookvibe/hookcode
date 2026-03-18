// Validate runtime probe ordering so Windows hosts try `python` / `py -3` instead of assuming `python3` exists. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

const setPlatform = (value: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value
  });
};

describe('runtimeService detectors', () => {
  afterEach(() => {
    jest.resetModules();
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  test('prefers Windows-friendly Python launcher fallbacks on win32', () => {
    setPlatform('win32');

    jest.isolateModules(() => {
      const { DETECTORS } = require('../../services/runtimeService');
      expect(DETECTORS.python.probes).toEqual([
        { cmd: 'python', args: ['--version'] },
        { cmd: 'py', args: ['-3', '--version'] },
        { cmd: 'python3', args: ['--version'] }
      ]);
    });
  });
});
