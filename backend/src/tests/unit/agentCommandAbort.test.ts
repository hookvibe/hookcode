import { runCommandCapture, runCommandWithLogs } from '../../agent/agent';

// Extend the per-file Jest timeout so CI CPU contention does not hide abort-regression signals behind the default 5s ceiling. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
jest.setTimeout(15000);

// Verify task stop requests can interrupt long-running shell commands before queued work appears stuck in processing. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
describe('agent shell command aborts', () => {
  test('aborts streaming commands quickly', async () => {
    const controller = new AbortController();
    const logs: string[] = [];
    const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify("console.log('ready'); setInterval(() => {}, 1000)")}`;
    const startedAt = Date.now();

    const result = await runCommandWithLogs(
      command,
      async (line) => {
        logs.push(line);
        if (line === 'ready') controller.abort();
      },
      { signal: controller.signal }
    );

    expect(result.exitCode).toBe(-1);
    expect(Date.now() - startedAt).toBeLessThan(3000);
    expect(logs).toContain('ready');
    expect(result.output).toContain('[aborted]');
  });

  test('aborts silent capture commands quickly', async () => {
    const controller = new AbortController();
    const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify('setInterval(() => {}, 1000)')}`;
    const startedAt = Date.now();
    setTimeout(() => controller.abort(), 100);

    const result = await runCommandCapture(command, { signal: controller.signal });

    expect(result.exitCode).toBe(-1);
    expect(Date.now() - startedAt).toBeLessThan(3000);
  });
});
