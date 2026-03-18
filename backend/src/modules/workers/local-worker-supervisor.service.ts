import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { stopChildProcessTree } from '../../utils/crossPlatformSpawn';
import { resolveBackendWorkDirRoot, resolveBuildRoot } from '../../utils/workDir';
import { WorkersService } from './workers.service';
import { evaluateWorkerVersion, getWorkerVersionRequirement } from './worker-version-policy';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const WORKER_PACKAGE_NAME = '@hookvibe/hookcode-worker';

export const normalizeLocalWorkerBackendUrl = (backendBaseUrl: string): string => {
  const fallback = 'http://127.0.0.1:3000/api';
  const raw = trimString(backendBaseUrl) || fallback;
  try {
    const url = new URL(raw);
    // Route the local supervised worker back through a loopback address when the backend listens on a wildcard host. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    if (url.hostname === '0.0.0.0' || url.hostname === '::' || url.hostname === '[::]') {
      url.hostname = '127.0.0.1';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
};

export const resolveInstalledWorkerPackage = (
  resolve = require.resolve,
  load: (id: string) => { bin?: string | Record<string, string>; version?: string } = require
): { entryPath: string; version?: string } | null => {
  try {
    const packageJsonPath = resolve(`${WORKER_PACKAGE_NAME}/package.json`);
    const manifest = load(packageJsonPath);
    const rawBin =
      typeof manifest.bin === 'string'
        ? manifest.bin
        : manifest.bin && typeof manifest.bin['hookcode-worker'] === 'string'
          ? manifest.bin['hookcode-worker']
          : null;
    if (!rawBin) return null;
    return {
      entryPath: path.resolve(path.dirname(packageJsonPath), rawBin),
      version: trimString(manifest.version) || undefined
    };
  } catch {
    return null;
  }
};

@Injectable()
export class LocalWorkerSupervisorService {
  private child: ChildProcess | null = null;
  private workerId: string | null = null;

  constructor(private readonly workersService: WorkersService) {}

  async start(params: { backendBaseUrl: string }): Promise<void> {
    if (this.child) return;
    const normalizedBackendUrl = normalizeLocalWorkerBackendUrl(params.backendBaseUrl);
    const ensured = await this.workersService.ensureLocalSystemWorker({
      name: 'Local Backend Worker',
      backendBaseUrl: normalizedBackendUrl,
      maxConcurrency: 2
    });
    this.workerId = ensured.worker.id;

    const env = {
      ...process.env,
      HOOKCODE_WORKER_BIND_CODE: ensured.bindCode,
      HOOKCODE_WORKER_FORCE_RECONFIGURE: '1',
      HOOKCODE_WORKER_KIND: 'local',
      HOOKCODE_WORKER_NAME: 'Local Backend Worker',
      HOOKCODE_WORKER_PREVIEW: '1',
      HOOKCODE_WORKER_MAX_CONCURRENCY: String(ensured.worker.maxConcurrency ?? 2),
      // Pass the resolved backend work root to the supervised local worker so relative HOOKCODE_WORK_DIR values do not diverge across processes. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      HOOKCODE_WORK_DIR: resolveBackendWorkDirRoot(resolveBuildRoot())
    };

    const workerPackage = resolveInstalledWorkerPackage();
    const versionRequirement = getWorkerVersionRequirement();
    if (!workerPackage) {
      console.warn(
        `[workers] installed worker package ${WORKER_PACKAGE_NAME} could not be resolved; local worker supervisor skipped. Install with: ${versionRequirement.npmInstallCommand}`
      );
      return;
    }
    const versionState = evaluateWorkerVersion(workerPackage.version);
    if (versionState.upgradeRequired) {
      console.warn(
        `[workers] installed worker package ${WORKER_PACKAGE_NAME} version ${versionState.currentVersion ?? 'unknown'} does not satisfy required version ${versionRequirement.requiredVersion}; local worker supervisor skipped. Upgrade with: ${versionRequirement.npmInstallCommand}`
      );
      return;
    }

    // Spawn the installed npm worker package so source-mode backends use the published executor runtime instead of a monorepo-local worker path.
    const baseOpts: import('child_process').SpawnOptions = { cwd: process.cwd(), env, stdio: 'inherit' };
    this.child = spawn(process.execPath, [workerPackage.entryPath], baseOpts);

    this.child.on('exit', (code, signal) => {
      console.warn('[workers] local worker exited', { code, signal });
      this.child = null;
      if (this.workerId) {
        void this.workersService.markWorkerOffline(this.workerId, `process_exit:${code ?? signal ?? 'unknown'}`);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    try {
      // Stop the supervised worker tree instead of only the outer shell so Windows dev restarts do not leave orphan executors behind. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
      stopChildProcessTree(this.child, 'SIGTERM');
    } catch {
      // ignore
    }
    this.child = null;
    if (this.workerId) {
      await this.workersService.markWorkerOffline(this.workerId, 'backend_shutdown');
    }
  }
}
