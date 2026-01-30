// Define dependency management types shared across config parsing and execution. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
export type DependencyFailureMode = 'soft' | 'hard';

// Normalize runtime requirements for multi-language dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
export interface RuntimeRequirement {
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  version?: string;
  install?: string;
  workdir?: string;
}

// Represent preview instance configuration in `.hookcode.yml` (runtime ports are assigned via PORT env). docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewInstanceConfig {
  name: string;
  command: string;
  workdir: string;
  // Allow per-instance env overrides with PORT placeholder support. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  env?: Record<string, string>;
  readyPattern?: string;
}

// Group preview instances under the repository-level preview config. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewConfig {
  instances: PreviewInstanceConfig[];
}

// Represent `.hookcode.yml` dependency configuration. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
export interface HookcodeConfig {
  version: 1;
  dependency?: {
    failureMode: DependencyFailureMode;
    runtimes: RuntimeRequirement[];
  };
  preview?: PreviewConfig;
}

// Capture robot-level overrides for dependency execution. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
export interface RobotDependencyConfig {
  enabled?: boolean;
  failureMode?: DependencyFailureMode;
  allowCustomInstall?: boolean;
}

// Track per-runtime install steps for reporting and persistence. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
export interface InstallStep {
  language: RuntimeRequirement['language'];
  command?: string;
  workdir?: string;
  status: 'success' | 'skipped' | 'failed';
  duration?: number;
  error?: string;
  reason?: string;
}

// Store aggregated dependency install outcomes for each task. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
export interface DependencyResult {
  status: 'success' | 'partial' | 'skipped' | 'failed';
  steps: InstallStep[];
  totalDuration: number;
}
