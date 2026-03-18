// Cover Windows-specific runtime probe fallbacks so worker capability heartbeats do not under-report Python support. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
import { resolveRuntimeProbeMatrix } from '../runtime/hostCapabilities';

describe('resolveRuntimeProbeMatrix', () => {
  test('includes Windows Python launcher fallbacks', () => {
    const python = resolveRuntimeProbeMatrix('win32').find((runtime) => runtime.language === 'python');

    expect(python?.candidates).toEqual([
      { command: 'python', args: ['--version'] },
      { command: 'py', args: ['-3', '--version'] },
      { command: 'python3', args: ['--version'] }
    ]);
  });
});
