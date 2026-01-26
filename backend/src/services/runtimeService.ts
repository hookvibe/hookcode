import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface RuntimeInfo {
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  version: string;
  path: string;
  packageManager?: string;
}

type RuntimeDetector = {
  cmd: string;
  args: string[];
  pm?: string;
};

const DETECTORS: Record<RuntimeInfo['language'], RuntimeDetector> = {
  node: { cmd: 'node', args: ['--version'], pm: 'npm' },
  python: { cmd: 'python3', args: ['--version'], pm: 'pip' },
  java: { cmd: 'java', args: ['--version'], pm: 'mvn' },
  ruby: { cmd: 'ruby', args: ['--version'], pm: 'gem' },
  go: { cmd: 'go', args: ['version'], pm: 'go' }
};

const extractVersion = (output: string): string => {
  // Extract a version token from runtime command output. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const match = output.match(/(\d+\.\d+(\.\d+)?(\.\d+)?)/);
  return match ? match[1] : output.trim();
};

const resolveCommandPath = async (cmd: string): Promise<string | null> => {
  // Resolve runtime binary paths so the API reports usable executables. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  try {
    const { stdout } = await execFileAsync('sh', ['-lc', `command -v ${cmd}`], { timeout: 2000 });
    const resolved = stdout.trim();
    return resolved ? resolved : null;
  } catch {
    return null;
  }
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
    try {
      const { stdout, stderr } = await execFileAsync(detector.cmd, detector.args, { timeout: 5000 });
      const output = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
      if (!output) return null;
      const version = extractVersion(output);
      const path = (await resolveCommandPath(detector.cmd)) ?? detector.cmd;
      return {
        language,
        version,
        path,
        packageManager: detector.pm
      };
    } catch {
      return null;
    }
  }
}
