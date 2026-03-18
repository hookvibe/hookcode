import type { WorkerCapabilities, WorkerRuntimeState } from '../protocol';
import { xSpawnSync } from './crossPlatformSpawn';

type RuntimeProbeCandidate = {
  command: string;
  args: string[];
};

// Probe Python with Windows-friendly launcher fallbacks so worker heartbeats report Python when hosts expose `python` or `py -3` instead of `python3`. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
export const resolveRuntimeProbeMatrix = (platform: NodeJS.Platform = process.platform): Array<{
  language: string;
  version?: string;
  path?: string;
  candidates?: RuntimeProbeCandidate[];
}> => [
  { language: 'node', version: process.version, path: process.execPath },
  {
    language: 'python',
    candidates:
      platform === 'win32'
        ? [
            { command: 'python', args: ['--version'] },
            { command: 'py', args: ['-3', '--version'] },
            { command: 'python3', args: ['--version'] }
          ]
        : [
            { command: 'python3', args: ['--version'] },
            { command: 'python', args: ['--version'] }
          ]
  },
  { language: 'git', candidates: [{ command: 'git', args: ['--version'] }] }
];

const detectBinaryVersion = (candidates: RuntimeProbeCandidate[] = []): string | undefined => {
  for (const candidate of candidates) {
    const result = xSpawnSync(candidate.command, candidate.args, { encoding: 'utf8', timeout: 2_000 });
    if (result.error || result.status !== 0) continue;
    const output = `${result.stdout ?? ''} ${result.stderr ?? ''}`.trim();
    if (!output) continue;
    return output.split(/\s+/).slice(0, 3).join(' ');
  }
  return undefined;
};

export const detectHostCapabilities = (preview: boolean, runtimeState: WorkerRuntimeState): WorkerCapabilities => {
  // Report coarse host capabilities in hello/heartbeat so backend can reason about worker readiness without remote shell access. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const runtimes = resolveRuntimeProbeMatrix()
    .map((runtime) => ({
      language: runtime.language,
      version: runtime.version ?? detectBinaryVersion(runtime.candidates),
      path: runtime.path
    }))
    .filter((runtime) => runtime.version);

  return {
    preview,
    runtimes,
    providers: runtimeState.preparedProviders ?? []
  };
};
