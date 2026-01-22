import { getTaskConsoleUrl } from '../../utils/taskConsoleUrl';

// Verify task console URLs are built consistently from env-configured prefixes/bases. docs/en/developer/plans/taskdetailbacklink20260122k4p8/task_plan.md taskdetailbacklink20260122k4p8

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

describe('getTaskConsoleUrl', () => {
  const prevPrefix = process.env.HOOKCODE_CONSOLE_TASK_URL_PREFIX;
  const prevBase = process.env.HOOKCODE_CONSOLE_BASE_URL;

  afterEach(() => {
    setEnv('HOOKCODE_CONSOLE_TASK_URL_PREFIX', prevPrefix);
    setEnv('HOOKCODE_CONSOLE_BASE_URL', prevBase);
  });

  test('uses HOOKCODE_CONSOLE_TASK_URL_PREFIX when provided (trailing slash)', () => {
    setEnv('HOOKCODE_CONSOLE_TASK_URL_PREFIX', 'https://hookcode.example/#/tasks/');
    setEnv('HOOKCODE_CONSOLE_BASE_URL', undefined);
    expect(getTaskConsoleUrl('task_1')).toBe('https://hookcode.example/#/tasks/task_1');
  });

  test('uses HOOKCODE_CONSOLE_TASK_URL_PREFIX when provided (no trailing slash)', () => {
    setEnv('HOOKCODE_CONSOLE_TASK_URL_PREFIX', 'https://hookcode.example/#/tasks');
    setEnv('HOOKCODE_CONSOLE_BASE_URL', undefined);
    expect(getTaskConsoleUrl('task_1')).toBe('https://hookcode.example/#/tasks/task_1');
  });

  test('falls back to HOOKCODE_CONSOLE_BASE_URL when task prefix is missing', () => {
    setEnv('HOOKCODE_CONSOLE_TASK_URL_PREFIX', '');
    setEnv('HOOKCODE_CONSOLE_BASE_URL', 'https://console.example');
    expect(getTaskConsoleUrl('task_1')).toBe('https://console.example/#/tasks/task_1');
  });

  test('falls back to localhost when both prefix and base are missing', () => {
    setEnv('HOOKCODE_CONSOLE_TASK_URL_PREFIX', '');
    setEnv('HOOKCODE_CONSOLE_BASE_URL', '');
    expect(getTaskConsoleUrl('task_1')).toBe('http://localhost:5173/#/tasks/task_1');
  });
});

