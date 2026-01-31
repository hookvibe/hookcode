import path from 'path';
import { existsSync } from 'fs';
import type { HookcodeConfig, DependencyResult, DependencyFailureMode, RuntimeRequirement } from '../types/dependency';
import { validateInstallCommand } from '../services/installCommandValidator';
import type { RuntimeService } from '../services/runtimeService';

// Surface dependency install failures with explicit error codes for task handling. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
export class DependencyInstallerError extends Error {
  readonly code: 'RUNTIME_MISSING' | 'INSTALL_FAILED' | 'COMMAND_BLOCKED' | 'WORKDIR_INVALID';
  readonly result: DependencyResult;

  constructor(
    message: string,
    code: DependencyInstallerError['code'],
    result: DependencyResult
  ) {
    super(message);
    this.name = 'DependencyInstallerError';
    this.code = code;
    this.result = result;
  }
}

export interface DependencyInstallerParams {
  workspaceDir: string;
  config: HookcodeConfig | null;
  runtimeService: RuntimeService;
  failureMode?: DependencyFailureMode;
  allowCustomInstall?: boolean;
  appendLog: (msg: string) => Promise<void>;
  runCommand: (params: { command: string; cwd: string; timeoutMs: number }) => Promise<{ exitCode: number | null; output: string }>;
  appendThoughtChainCommand?: (params: {
    id: string;
    status: 'started' | 'completed' | 'failed';
    command: string;
    output?: string;
    exitCode?: number | null;
  }) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const resolveWorkdir = (repoDir: string, workdir?: string): { ok: true; dir: string; label: string } | { ok: false; reason: string } => {
  // Ensure install workdirs stay within the cloned repository root. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const trimmed = String(workdir ?? '').trim();
  if (!trimmed) {
    return { ok: true, dir: repoDir, label: '.' };
  }
  if (path.isAbsolute(trimmed)) {
    return { ok: false, reason: 'workdir must be a relative path' };
  }
  const resolved = path.resolve(repoDir, trimmed);
  const relative = path.relative(repoDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, reason: 'workdir must stay within the repository root' };
  }
  return { ok: true, dir: resolved, label: trimmed };
};

const findNearestPnpmWorkspaceFile = (startDir: string): string | null => {
  // Detect pnpm-workspace.yaml to avoid installs escaping to parent workspaces. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  let current = startDir;
  while (true) {
    const candidate = path.join(current, 'pnpm-workspace.yaml');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const normalizeInstallCommand = (command: string, workspaceDir: string): string => {
  // Append pnpm's --ignore-workspace when a parent workspace would hijack installs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const trimmed = String(command ?? '').trim();
  if (!/^pnpm(\s|$)/.test(trimmed)) return command;
  if (/\s--ignore-workspace(\s|$)/.test(trimmed)) return command;
  const workspaceFile = findNearestPnpmWorkspaceFile(workspaceDir);
  if (!workspaceFile) return command;
  const relative = path.relative(workspaceDir, workspaceFile);
  const inRepo = relative === 'pnpm-workspace.yaml' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  if (inRepo) return command;
  return `${trimmed} --ignore-workspace`;
};

const mergeFailureMode = (config: HookcodeConfig | null, override?: DependencyFailureMode): DependencyFailureMode => {
  // Resolve final failure mode by combining config and robot overrides. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const fromConfig = config?.dependency?.failureMode ?? 'soft';
  return override ?? fromConfig;
};

const buildResultStatus = (steps: DependencyResult['steps']): DependencyResult['status'] => {
  // Derive overall dependency result status from step outcomes. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  if (!steps.length) return 'skipped';
  const hasFailed = steps.some((step) => step.status === 'failed');
  if (hasFailed) return 'failed';
  const hasSuccess = steps.some((step) => step.status === 'success');
  const hasSkipped = steps.some((step) => step.status === 'skipped');
  if (hasSuccess && hasSkipped) return 'partial';
  if (hasSuccess) return 'success';
  return 'skipped';
};

export const installDependencies = async (params: DependencyInstallerParams): Promise<DependencyResult> => {
  // Execute dependency installs for each runtime entry before model execution. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const config = params.config;
  const runtimeList = config?.dependency?.runtimes ?? [];
  if (!runtimeList.length) {
    return { status: 'skipped', steps: [], totalDuration: 0 };
  }

  const failureMode = mergeFailureMode(config, params.failureMode);
  const steps: DependencyResult['steps'] = [];
  const startedAt = Date.now();

  for (let index = 0; index < runtimeList.length; index += 1) {
    const runtime = runtimeList[index];
    const language = runtime.language;
    const install = runtime.install ? String(runtime.install).trim() : '';
    const workdir = runtime.workdir ? String(runtime.workdir).trim() : undefined;
    const stepId = `dependency_install_${language}_${index + 1}`;

    if (!params.runtimeService.hasRuntime(language)) {
      const message = `Runtime "${language}" is required but not installed`;
      await params.appendLog(message);
      const step = {
        language,
        command: install || undefined,
        workdir,
        status: failureMode === 'hard' ? 'failed' : 'skipped',
        error: failureMode === 'hard' ? message : undefined,
        reason: 'runtime_missing'
      } as const;
      steps.push(step);
      if (failureMode === 'hard') {
        const result: DependencyResult = {
          status: 'failed',
          steps: [...steps],
          totalDuration: Date.now() - startedAt
        };
        throw new DependencyInstallerError(message, 'RUNTIME_MISSING', result);
      }
      continue;
    }

    if (!install) {
      steps.push({ language, status: 'skipped', reason: 'no_install_command', workdir });
      continue;
    }

    const command = normalizeInstallCommand(install, params.workspaceDir);
    const validation = validateInstallCommand(language, command, { allowCustomInstall: params.allowCustomInstall });
    if (!validation.valid) {
      const message = `Install command blocked: ${validation.reason ?? 'invalid command'}`;
      await params.appendLog(message);
      const step = {
        language,
        command,
        workdir,
        status: failureMode === 'hard' ? 'failed' : 'skipped',
        error: failureMode === 'hard' ? message : undefined,
        reason: validation.reasonCode ?? 'not_allowed'
      } as const;
      steps.push(step);
      if (failureMode === 'hard') {
        const result: DependencyResult = {
          status: 'failed',
          steps: [...steps],
          totalDuration: Date.now() - startedAt
        };
        throw new DependencyInstallerError(message, 'COMMAND_BLOCKED', result);
      }
      continue;
    }

    const workdirResolved = resolveWorkdir(params.workspaceDir, workdir);
    if (!workdirResolved.ok) {
      const message = `Invalid workdir for ${language}: ${workdirResolved.reason}`;
      await params.appendLog(message);
      const step = {
        language,
        command,
        workdir,
        status: failureMode === 'hard' ? 'failed' : 'skipped',
        error: failureMode === 'hard' ? message : undefined,
        reason: 'workdir_invalid'
      } as const;
      steps.push(step);
      if (failureMode === 'hard') {
        const result: DependencyResult = {
          status: 'failed',
          steps: [...steps],
          totalDuration: Date.now() - startedAt
        };
        throw new DependencyInstallerError(message, 'WORKDIR_INVALID', result);
      }
      continue;
    }

    const commandLabel = workdirResolved.label === '.' ? command : `(${workdirResolved.label}) ${command}`;
    await params.appendLog(`Installing ${language} dependencies: ${commandLabel}`);
    const startedAtStep = Date.now();
    if (params.appendThoughtChainCommand) {
      await params.appendThoughtChainCommand({ id: stepId, status: 'started', command: commandLabel });
    }
    try {
      const execResult = await params.runCommand({
        command,
        cwd: workdirResolved.dir,
        timeoutMs: DEFAULT_TIMEOUT_MS
      });
      const duration = Date.now() - startedAtStep;
      const step = {
        language,
        command,
        workdir,
        status: execResult.exitCode === 0 ? 'success' : 'failed',
        duration,
        error: execResult.exitCode === 0 ? undefined : `exit code ${execResult.exitCode ?? 'unknown'}`
      } as const;
      steps.push(step);
      if (params.appendThoughtChainCommand) {
        await params.appendThoughtChainCommand({
          id: stepId,
          status: execResult.exitCode === 0 ? 'completed' : 'failed',
          command: commandLabel,
          output: execResult.output,
          exitCode: execResult.exitCode
        });
      }
      if (execResult.exitCode !== 0 && failureMode === 'hard') {
        const message = `Dependency install failed for ${language}`;
        const result: DependencyResult = {
          status: 'failed',
          steps: [...steps],
          totalDuration: Date.now() - startedAt
        };
        throw new DependencyInstallerError(message, 'INSTALL_FAILED', result);
      }
    } catch (err) {
      const duration = Date.now() - startedAtStep;
      const message = err instanceof Error ? err.message : String(err);
      const step = {
        language,
        command,
        workdir,
        status: failureMode === 'hard' ? 'failed' : 'skipped',
        duration,
        error: message
      } as const;
      steps.push(step);
      if (params.appendThoughtChainCommand) {
        await params.appendThoughtChainCommand({
          id: stepId,
          status: 'failed',
          command: commandLabel,
          output: message,
          exitCode: null
        });
      }
      if (failureMode === 'hard') {
        const result: DependencyResult = {
          status: 'failed',
          steps: [...steps],
          totalDuration: Date.now() - startedAt
        };
        throw new DependencyInstallerError(message, 'INSTALL_FAILED', result);
      }
    }
  }

  const result: DependencyResult = {
    status: buildResultStatus(steps),
    steps,
    totalDuration: Date.now() - startedAt
  };
  return result;
};
