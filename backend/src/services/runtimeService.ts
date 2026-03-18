import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
// Use cross-platform command resolution instead of Unix-only `sh -lc "command -v ..."`. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
import { resolveCommandPath as xResolveCommandPath } from '../utils/crossPlatformSpawn';

const execFileAsync = promisify(execFile);

export interface RuntimeInfo {
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  version: string;
  path: string;
  packageManager?: string;
}

type RuntimeDetector = {
  probes: Array<{ cmd: string; args: string[] }>;
  pm?: string;
};

// Probe Python with Windows-friendly launchers so runtime discovery reports Python on hosts that expose `python` or `py -3` instead of `python3`. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
export const DETECTORS: Record<RuntimeInfo['language'], RuntimeDetector> = {
  node: { probes: [{ cmd: 'node', args: ['--version'] }], pm: 'npm' },
  python: {
    probes:
      process.platform === 'win32'
        ? [
            { cmd: 'python', args: ['--version'] },
            { cmd: 'py', args: ['-3', '--version'] },
            { cmd: 'python3', args: ['--version'] }
          ]
        : [
            { cmd: 'python3', args: ['--version'] },
            { cmd: 'python', args: ['--version'] }
          ],
    pm: 'pip'
  },
  java: { probes: [{ cmd: 'java', args: ['--version'] }], pm: 'mvn' },
  ruby: { probes: [{ cmd: 'ruby', args: ['--version'] }], pm: 'gem' },
  go: { probes: [{ cmd: 'go', args: ['version'] }], pm: 'go' }
};

const extractVersion = (output: string): string => {
  // Extract a version token from runtime command output. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const match = output.match(/(\d+\.\d+(\.\d+)?(\.\d+)?)/);
  return match ? match[1] : output.trim();
};

const resolveCommandPath = async (cmd: string): Promise<string | null> => {
  // Cross-platform command resolution (works on both POSIX and Windows). docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
  return xResolveCommandPath(cmd);
};

@Injectable()
export class RuntimeService {
  private cache: RuntimeInfo[] | null = null;
  private detectedAt: string | null = null;

  async detectRuntimes(): Promise<RuntimeInfo[]> {
    // Detect and cache available runtimes at startup for dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const results: RuntimeInfo[] = [];

    for (const [language, detector] of Object.entries(DETECTORS) as [RuntimeInfo['language'], RuntimeDetector][]) {
      const runtime = await this.probeRuntime(language, detector);
      if (runtime) results.push(runtime);
    }

    this.cache = results;
    this.detectedAt = new Date().toISOString();
    return results;
  }

  getRuntimes(): RuntimeInfo[] {
    // Return cached runtime data for API callers without re-probing. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    return this.cache ? [...this.cache] : [];
  }

  getDetectedAt(): string | null {
    // Expose last detection timestamp for debugging/runtime visibility. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    return this.detectedAt;
  }

  hasRuntime(language: string): boolean {
    // Validate required runtimes before dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    return Boolean(this.cache?.some((rt) => rt.language === language));
  }

  private async probeRuntime(language: RuntimeInfo['language'], detector: RuntimeDetector): Promise<RuntimeInfo | null> {
    // Attempt to probe a runtime binary and capture its version for reporting. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    for (const probe of detector.probes) {
      try {
        const { stdout, stderr } = await execFileAsync(probe.cmd, probe.args, { timeout: 5000 });
        const output = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
        if (!output) continue;
        const version = extractVersion(output);
        const path = (await resolveCommandPath(probe.cmd)) ?? probe.cmd;
        return {
          language,
          version,
          path,
          packageManager: detector.pm
        };
      } catch {
        // Keep probing platform-specific fallbacks until one runtime launcher succeeds. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
      }
    }
    return null;
  }
}
