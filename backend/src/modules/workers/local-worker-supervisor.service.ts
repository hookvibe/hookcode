import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { stopChildProcessTree } from '../../utils/crossPlatformSpawn';
import { resolveBackendWorkDirRoot, resolveBuildRoot } from '../../utils/workDir';
import { WorkersService } from './workers.service';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

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

    const repoRoot = path.resolve(process.cwd(), '..');
    const workerEntry = path.resolve(process.cwd(), '../worker/dist/main.js');
    const workerPackageJson = path.resolve(process.cwd(), '../worker/package.json');
    const isBuiltWorkerAvailable = require('fs').existsSync(workerEntry);
    const isWorkerPackagePresent = require('fs').existsSync(workerPackageJson);
    if (!isWorkerPackagePresent) {
      console.warn('[workers] worker package is missing; local worker supervisor skipped');
      return;
    }

    const env = {
      ...process.env,
      HOOKCODE_WORKER_ID: ensured.worker.id,
      HOOKCODE_WORKER_TOKEN: ensured.token,
      HOOKCODE_BACKEND_URL: normalizedBackendUrl,
      HOOKCODE_WORKER_KIND: 'local',
      HOOKCODE_WORKER_NAME: 'Local Backend Worker',
      HOOKCODE_WORKER_PREVIEW: '1',
      HOOKCODE_WORKER_MAX_CONCURRENCY: String(ensured.worker.maxConcurrency ?? 2),
      // Pass the resolved backend work root to the supervised local worker so relative HOOKCODE_WORK_DIR values do not diverge across processes. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      HOOKCODE_WORK_DIR: resolveBackendWorkDirRoot(resolveBuildRoot())
    };

    // Spawn the colocated worker package automatically so each backend keeps one local executor online. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    // Use shell on Windows only for pnpm (a .cmd shim); skip shell for direct node binary to avoid
    // path-with-spaces breakage (e.g. "C:\Program Files\nodejs\node.exe"). docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
    const baseOpts: import('child_process').SpawnOptions = { cwd: repoRoot, env, stdio: 'inherit' };
    this.child = isBuiltWorkerAvailable
      ? spawn(process.execPath, [workerEntry], baseOpts)
      : spawn('pnpm', ['--filter', 'hookcode-worker', 'dev'], { ...baseOpts, shell: process.platform === 'win32' });

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
