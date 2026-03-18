import type { SpawnSyncOptions, SpawnSyncReturns } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { WorkerRuntimeState } from '../protocol';
import { xSpawn, xSpawnSync } from './crossPlatformSpawn';

const PROVIDER_PACKAGES: Record<string, string[]> = {
  codex: ['@openai/codex-sdk'],
  claude_code: ['@anthropic-ai/claude-agent-sdk'],
  gemini_cli: ['@google/gemini-cli']
};

const packageIsResolvable = (pkg: string): boolean => {
  try {
    require.resolve(pkg);
    return true;
  } catch {
    return false;
  }
};

const applyNodePath = (vendorDir: string): void => {
  const nodeModulesDir = path.join(vendorDir, 'node_modules');
  const current = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  if (!current.includes(nodeModulesDir)) {
    process.env.NODE_PATH = [...current, nodeModulesDir].filter(Boolean).join(path.delimiter);
    const moduleLib = require('module') as { _initPaths?: () => void };
    moduleLib._initPaths?.();
  }
};

export const detectNpmCommand = (
  runSync: (command: string, args: string[], opts?: SpawnSyncOptions) => SpawnSyncReturns<Buffer | string> = xSpawnSync
): { command: string; args: string[] } => {
  // Prefer pnpm when available, but keep npm as a fallback so the worker can bootstrap on clean machines. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  // Reuse the cross-platform spawn wrapper so Windows `.cmd` shims are probed the same way as real execution commands. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
  const pnpmCheck = runSync('pnpm', ['--version'], { stdio: 'ignore' });
  if (!pnpmCheck.error && pnpmCheck.status === 0) {
    return { command: 'pnpm', args: ['add', '--ignore-workspace', '--save-prod'] };
  }
  return { command: 'npm', args: ['install', '--no-save'] };
};

const installPackages = async (vendorDir: string, packages: string[]): Promise<void> => {
  await mkdir(vendorDir, { recursive: true });
  await writeFile(path.join(vendorDir, 'package.json'), JSON.stringify({ name: 'hookcode-worker-vendor', private: true }, null, 2));
  const { command, args } = detectNpmCommand();
  await new Promise<void>((resolve, reject) => {
    const child = xSpawn(command, [...args, ...packages], {
      cwd: vendorDir,
      stdio: 'inherit',
      env: process.env
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
};

export const applyWorkerVendorNodePath = (vendorDir: string): void => {
  // Extend NODE_PATH with the worker-owned vendor directory so runtime-installed provider SDKs stay isolated from project deps. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  applyNodePath(vendorDir);
};

export const resolvePreparedProviders = (): string[] => {
  return Object.entries(PROVIDER_PACKAGES)
    .filter(([, packages]) => packages.every((pkg) => packageIsResolvable(pkg)))
    .map(([provider]) => provider);
};

export const prepareRuntimeProviders = async (
  vendorDir: string,
  providers?: string[],
  priorState?: WorkerRuntimeState
): Promise<WorkerRuntimeState> => {
  const targets = Array.from(new Set((providers ?? Object.keys(PROVIDER_PACKAGES)).filter((provider) => provider in PROVIDER_PACKAGES)));
  const runtimeState: WorkerRuntimeState = {
    preparedProviders: priorState?.preparedProviders ?? resolvePreparedProviders(),
    preparingProviders: targets,
    lastPrepareAt: new Date().toISOString(),
    lastPrepareError: undefined
  };
  applyNodePath(vendorDir);

  try {
    const missingPackages = Array.from(
      new Set(targets.flatMap((provider) => PROVIDER_PACKAGES[provider] ?? []).filter((pkg) => !packageIsResolvable(pkg)))
    );
    if (missingPackages.length > 0) {
      // Install provider runtimes only when requested so the distributed worker package can remain small by default. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      await installPackages(vendorDir, missingPackages);
      applyNodePath(vendorDir);
    }
    return {
      preparedProviders: resolvePreparedProviders(),
      preparingProviders: [],
      lastPrepareAt: new Date().toISOString(),
      lastPrepareError: undefined
    };
  } catch (error) {
    return {
      preparedProviders: resolvePreparedProviders(),
      preparingProviders: [],
      lastPrepareAt: new Date().toISOString(),
      lastPrepareError: error instanceof Error ? error.message : String(error)
    };
  }
};

export const resolveTaskProvidersFromContext = (context: {
  task?: Record<string, unknown> | null;
  robotsInRepo?: Array<Record<string, unknown>>;
}): string[] => {
  const robotId = typeof context.task?.robotId === 'string' ? context.task.robotId : '';
  const robot = Array.isArray(context.robotsInRepo)
    ? context.robotsInRepo.find((entry) => String(entry?.id ?? '') === robotId)
    : undefined;
  const provider = typeof robot?.modelProvider === 'string' ? robot.modelProvider : 'codex';
  return provider in PROVIDER_PACKAGES ? [provider] : ['codex'];
};
