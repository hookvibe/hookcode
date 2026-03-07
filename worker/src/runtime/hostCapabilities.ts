import { spawnSync } from 'child_process';
import type { WorkerCapabilities, WorkerRuntimeState } from '../protocol';

const detectBinaryVersion = (command: string, args: string[]): string | undefined => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 2_000 });
  if (result.status !== 0) return undefined;
  const output = `${result.stdout ?? ''} ${result.stderr ?? ''}`.trim();
  return output ? output.split(/\s+/).slice(0, 3).join(' ') : undefined;
};

export const detectHostCapabilities = (preview: boolean, runtimeState: WorkerRuntimeState): WorkerCapabilities => {
  // Report coarse host capabilities in hello/heartbeat so backend can reason about worker readiness without remote shell access. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const runtimes = [
    { language: 'node', version: process.version, path: process.execPath },
    { language: 'python', version: detectBinaryVersion('python3', ['--version']) },
    { language: 'git', version: detectBinaryVersion('git', ['--version']) }
  ].filter((runtime) => runtime.version);

  return {
    preview,
    runtimes,
    providers: runtimeState.preparedProviders ?? []
  };
};
