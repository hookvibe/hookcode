import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { constants } from 'fs';
import { access, readdir, stat } from 'fs/promises';
import fs from 'fs';
import net from 'net';
import path from 'path';
import type { DependencyResult, HookcodeConfig, PreviewInstanceConfig } from '../../types/dependency';
import { installDependencies, DependencyInstallerError } from '../../agent/dependencyInstaller';
import {
  buildTaskGroupRootDir,
  buildTaskGroupWorkspaceDir,
  getRepoSlug,
  runCommandCapture
} from '../../agent/agent';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';
import { resolvePreviewEnv } from '../../utils/previewEnv';
import { buildPreviewPublicUrl } from '../../utils/previewHost';
import { RuntimeService } from '../../services/runtimeService';
import { PreviewPortPool } from './previewPortPool';
import type {
  PreviewDiagnostics,
  PreviewInstanceStatus,
  PreviewInstanceSummary,
  PreviewLogEntry,
  PreviewStatusSnapshot,
  RepoPreviewConfigSnapshot,
  RepoPreviewInstanceSummary
} from './preview.types';
import { PreviewLogStream } from './preview-log-stream.service';
import { TaskService } from './task.service';

const PREVIEW_START_TIMEOUT_MS = 5 * 60 * 1000;
const PREVIEW_START_POLL_MS = 500;
const PREVIEW_LOG_BUFFER_MAX = 500;
// Tune diagnostics/idle/config reload defaults for Phase 3 preview lifecycle. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
const PREVIEW_DIAGNOSTIC_LOG_TAIL = 80;
const PREVIEW_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const PREVIEW_IDLE_POLL_MS = 60 * 1000;
const PREVIEW_CONFIG_RELOAD_DEBOUNCE_MS = 750;

// Capture preview-specific error codes for controller mapping. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
class PreviewServiceError extends Error {
  // Inject preview log stream to power SSE logs in Phase 2. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  constructor(
    message: string,
    readonly code:
      | 'invalid_group'
      | 'missing_task'
      | 'workspace_missing'
      | 'config_missing'
      | 'config_invalid'
      | 'instance_invalid'
      | 'dependency_failed'
      | 'port_unavailable'
  ) {
    super(message);
    this.name = 'PreviewServiceError';
  }
}

interface PreviewInstanceRuntime {
  config: PreviewInstanceConfig;
  port: number;
  status: PreviewInstanceStatus;
  startedAt: string;
  readyAt?: string;
  message?: string;
  process?: ChildProcessWithoutNullStreams;
  exitCode?: number | null;
  exitSignal?: string | null;
  // Track the latest access timestamp for idle shutdown detection. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  lastAccessAt: number;
  // Keep an in-memory ring buffer for preview logs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  logs: PreviewLogEntry[];
}

interface PreviewGroupRuntime {
  taskGroupId: string;
  workspaceDir: string;
  configPath: string;
  instances: PreviewInstanceRuntime[];
}

@Injectable()
export class PreviewService implements OnModuleDestroy {
  private readonly portPool = new PreviewPortPool();
  private readonly groups = new Map<string, PreviewGroupRuntime>();
  private readonly startLocks = new Map<string, Promise<PreviewStatusSnapshot>>();
  // Maintain per-group config watchers and idle timers for Phase 3 hot reload/cleanup. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  private readonly configWatchers = new Map<string, fs.FSWatcher>();
  private readonly configReloadTimers = new Map<string, NodeJS.Timeout>();
  private readonly idleTimer: NodeJS.Timeout;

  constructor(
    private readonly taskService: TaskService,
    private readonly hookcodeConfigService: HookcodeConfigService,
    private readonly runtimeService: RuntimeService,
    private readonly previewLogStream: PreviewLogStream
  ) {
    // Start background idle cleanup for preview processes to avoid orphaned dev servers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.idleTimer = setInterval(() => {
      void this.stopIdlePreviews();
    }, PREVIEW_IDLE_POLL_MS);
    this.idleTimer.unref?.();
  }

  async getStatus(taskGroupId: string): Promise<PreviewStatusSnapshot> {
    // Surface preview availability and runtime state for the TaskGroup UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const configInfo = await this.resolvePreviewConfig(taskGroupId);
    if (!configInfo.available) return configInfo.snapshot;

    const runtime = this.groups.get(taskGroupId);
    if (!runtime) {
      return {
        available: true,
        instances: configInfo.config.preview!.instances.map((instance) => this.buildSummary(taskGroupId, instance, 'stopped'))
      };
    }

    return {
      available: true,
      instances: configInfo.config.preview!.instances.map((instance) => {
        const match = runtime.instances.find((item) => item.config.name === instance.name);
        if (!match) return this.buildSummary(taskGroupId, instance, 'stopped');
        return this.buildRuntimeSummary(taskGroupId, match);
      })
    };
  }

  async getLogSnapshot(
    taskGroupId: string,
    instanceName: string,
    options?: { tail?: number }
  ): Promise<{ instance: PreviewInstanceSummary; logs: PreviewLogEntry[] }> {
    // Provide initial log snapshots for preview SSE connections. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const configInfo = await this.resolvePreviewConfig(taskGroupId, { requireConfig: true });
    // Surface config invalid errors to log consumers instead of masking as missing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!configInfo.available) {
      const reason = configInfo.snapshot.reason ?? 'config_missing';
      const code = reason === 'config_invalid' ? 'config_invalid' : 'config_missing';
      throw new PreviewServiceError(`preview config ${code === 'config_invalid' ? 'invalid' : 'missing'}`, code);
    }

    const instanceConfig = configInfo.config.preview!.instances.find((instance) => instance.name === instanceName);
    if (!instanceConfig) throw new PreviewServiceError('preview instance not found', 'instance_invalid');

    const runtime = this.groups.get(taskGroupId);
    const runtimeInstance = runtime?.instances.find((item) => item.config.name === instanceName);
    const logs = runtimeInstance?.logs ?? [];
    const tail = options?.tail ?? 200;
    const sliced = tail > 0 ? logs.slice(-tail) : logs;

    const summary = runtimeInstance
      ? this.buildRuntimeSummary(taskGroupId, runtimeInstance)
      : this.buildSummary(taskGroupId, instanceConfig, 'stopped');

    return { instance: summary, logs: sliced };
  }

  async getRepoPreviewConfig(repoId: string): Promise<RepoPreviewConfigSnapshot> {
    // Resolve preview configuration for repo detail views without starting processes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const groups = await this.taskService.listTaskGroups({ repoId, limit: 1, archived: 'all', includeMeta: false });
    const latestGroup = groups[0];
    if (!latestGroup) {
      return { available: false, instances: [], reason: 'no_workspace' };
    }

    let workspaceDir = '';
    try {
      workspaceDir = await this.resolveWorkspaceDir(latestGroup.id);
    } catch (err) {
      if (err instanceof PreviewServiceError) {
        if (err.code === 'workspace_missing') {
          return { available: false, instances: [], reason: 'workspace_missing' };
        }
        if (err.code === 'missing_task') {
          return { available: false, instances: [], reason: 'no_workspace' };
        }
      }
      throw err;
    }

    let config: HookcodeConfig | null = null;
    try {
      config = await this.hookcodeConfigService.parseConfig(workspaceDir);
    } catch {
      return { available: false, instances: [], reason: 'config_invalid' };
    }

    if (!config?.preview?.instances?.length) {
      return { available: false, instances: [], reason: 'config_missing' };
    }

    const instances: RepoPreviewInstanceSummary[] = config.preview.instances.map((instance) => ({
      name: instance.name,
      workdir: instance.workdir
    }));

    return { available: true, instances };
  }

  async startPreview(taskGroupId: string): Promise<PreviewStatusSnapshot> {
    // Start preview dev servers for the task group if configured. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const existing = this.startLocks.get(taskGroupId);
    if (existing) return existing;

    const startPromise = this.startPreviewInternal(taskGroupId).finally(() => {
      this.startLocks.delete(taskGroupId);
    });
    this.startLocks.set(taskGroupId, startPromise);
    return startPromise;
  }

  async installPreviewDependencies(taskGroupId: string): Promise<DependencyResult> {
    // Provide a manual dependency reinstall hook for the preview start modal. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const configInfo = await this.resolvePreviewConfig(taskGroupId, { requireConfig: true });
    if (!configInfo.available) {
      const reason = configInfo.snapshot.reason ?? 'config_missing';
      const code = reason === 'config_invalid' ? 'config_invalid' : 'config_missing';
      throw new PreviewServiceError(`preview config ${code === 'config_invalid' ? 'invalid' : 'missing'}`, code);
    }

    await this.stopPreview(taskGroupId);
    const result = await this.installDependenciesIfNeeded(configInfo.workspaceDir, configInfo.config);
    return result ?? { status: 'skipped', steps: [], totalDuration: 0 };
  }

  async stopPreview(taskGroupId: string): Promise<void> {
    // Stop all preview processes for the task group and release ports. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const runtime = this.groups.get(taskGroupId);
    if (!runtime) return;

    this.clearConfigWatcher(taskGroupId);
    this.clearConfigReloadTimer(taskGroupId);
    await Promise.all(runtime.instances.map((instance) => this.stopInstance(taskGroupId, instance)));
    this.portPool.releaseTaskGroup(taskGroupId);
    this.groups.delete(taskGroupId);
  }

  getProxyTarget(taskGroupId: string, instanceName: string): { port: number; status: PreviewInstanceStatus } | null {
    // Resolve the preview instance port for proxy routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const runtime = this.groups.get(taskGroupId);
    if (!runtime) return null;
    const instance = runtime.instances.find((item) => item.config.name === instanceName);
    if (!instance) return null;
    return { port: instance.port, status: instance.status };
  }

  touchInstanceAccess(taskGroupId: string, instanceName: string, source?: string): void {
    // Track preview access timestamps so idle timeouts can stop inactive sessions. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const runtime = this.groups.get(taskGroupId);
    if (!runtime) return;
    const instance = runtime.instances.find((item) => item.config.name === instanceName);
    if (!instance) return;
    instance.lastAccessAt = Date.now();
    if (source && instance.status === 'starting') {
      this.appendSystemLog(taskGroupId, instance, `accessed while starting (${source})`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Ensure preview child processes are terminated when the module shuts down. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    clearInterval(this.idleTimer);
    this.clearAllConfigReloadTimers();
    const groupIds = Array.from(this.groups.keys());
    await Promise.all(groupIds.map((groupId) => this.stopPreview(groupId)));
  }

  private async startPreviewInternal(taskGroupId: string): Promise<PreviewStatusSnapshot> {
    const configInfo = await this.resolvePreviewConfig(taskGroupId, { requireConfig: true });
    // Normalize missing vs invalid preview config errors for API responses. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!configInfo.available) {
      const reason = configInfo.snapshot.reason ?? 'config_missing';
      const code = reason === 'config_invalid' ? 'config_invalid' : 'config_missing';
      throw new PreviewServiceError(`preview config ${code === 'config_invalid' ? 'invalid' : 'missing'}`, code);
    }

    await this.stopPreview(taskGroupId);

    const workspaceDir = configInfo.workspaceDir;
    await this.installDependenciesIfNeeded(workspaceDir, configInfo.config);

    const instances: PreviewInstanceRuntime[] = [];
    for (const instanceConfig of configInfo.config.preview!.instances) {
      const instance = await this.startInstance(taskGroupId, workspaceDir, instanceConfig);
      instances.push(instance);
    }

    const runtime: PreviewGroupRuntime = {
      taskGroupId,
      workspaceDir,
      configPath: this.resolveConfigPath(workspaceDir),
      instances
    };
    this.groups.set(taskGroupId, runtime);
    this.ensureConfigWatcher(taskGroupId, runtime.configPath);

    return {
      available: true,
      instances: instances.map((instance) => this.buildRuntimeSummary(taskGroupId, instance))
    };
  }

  private async startInstance(
    taskGroupId: string,
    workspaceDir: string,
    config: PreviewInstanceConfig
  ): Promise<PreviewInstanceRuntime> {
    // Spawn a dev server process for a preview instance. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const workdir = this.resolveInstanceWorkdir(workspaceDir, config.workdir);
    try {
      await access(workdir, constants.F_OK);
    } catch {
      throw new PreviewServiceError('preview workdir missing', 'instance_invalid');
    }
    const port = await this.safeAllocatePort(taskGroupId);

    // Merge resolved env placeholders while forcing backend-assigned PORT/HOST values. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const resolvedEnv = resolvePreviewEnv(config.env, port);
    const env = {
      ...process.env,
      ...resolvedEnv,
      PORT: String(port),
      HOST: '127.0.0.1',
      BROWSER: 'none'
    };
    const command = this.renderCommand(config.command, port);

    // Seed instance runtime metadata with a port-aware starting message for clearer readiness debugging. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const instance: PreviewInstanceRuntime = {
      config,
      port,
      status: 'starting',
      startedAt: new Date().toISOString(),
      message: `starting (port ${port})`,
      lastAccessAt: Date.now(),
      logs: []
    };

    const child = spawn('sh', ['-c', command], {
      cwd: workdir,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    instance.process = child;
    // Close stdin explicitly while keeping non-null streams for typing and logging. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    child.stdin.end();
    // Capture initial process logs for preview SSE consumers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.appendSystemLog(taskGroupId, instance, `spawned: ${command}`);

    // Capture exit details for diagnostics and ensure ports are released. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    child.on('exit', (code, signal) => {
      if (instance.status === 'running') {
        instance.status = 'failed';
      } else if (instance.status === 'starting') {
        instance.status = 'failed';
      }
      instance.exitCode = code;
      instance.exitSignal = signal;
      instance.message = signal ? `exited (${signal})` : `exited (${code ?? 'unknown'})`;
      this.appendSystemLog(
        taskGroupId,
        instance,
        signal ? `process exited (${signal})` : `process exited (${code ?? 'unknown'})`
      );
      this.portPool.releasePort(taskGroupId, port);
    });

    child.on('error', (err) => {
      instance.status = 'failed';
      instance.message = err instanceof Error ? err.message : String(err);
      this.appendSystemLog(taskGroupId, instance, `process error: ${instance.message ?? 'unknown error'}`);
      this.portPool.releasePort(taskGroupId, port);
    });

    // Stream stdout/stderr into the preview log buffer. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.attachLogStreaming(taskGroupId, instance);
    this.trackInstanceReadiness(taskGroupId, instance);

    return instance;
  }

  private trackInstanceReadiness(taskGroupId: string, instance: PreviewInstanceRuntime): void {
    // Detect readiness via logs or port probing with a startup timeout. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!instance.process) return;

    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved || instance.status !== 'starting') return;
      instance.status = 'timeout';
      instance.message = 'startup timeout';
      // Emit readiness failure into preview logs for troubleshooting. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      this.appendSystemLog(taskGroupId, instance, 'startup timeout');
      this.stopInstance(taskGroupId, instance, { keepStatus: true, keepMessage: true }).catch(() => undefined);
    }, PREVIEW_START_TIMEOUT_MS);

    const markReady = () => {
      if (resolved || instance.status !== 'starting') return;
      resolved = true;
      clearTimeout(timeout);
      instance.status = 'running';
      instance.readyAt = new Date().toISOString();
      instance.message = undefined;
      // Emit readiness success into preview logs for SSE clients. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      this.appendSystemLog(taskGroupId, instance, 'ready');
    };

    const readyPattern = instance.config.readyPattern ? new RegExp(instance.config.readyPattern) : null;
    if (readyPattern) {
      const handleChunk = (data: Buffer) => {
        const text = data.toString();
        if (readyPattern.test(text)) {
          cleanup();
          markReady();
        }
      };
      const cleanup = () => {
        instance.process?.stdout.off('data', handleChunk);
        instance.process?.stderr.off('data', handleChunk);
      };
      instance.process.stdout.on('data', handleChunk);
      instance.process.stderr.on('data', handleChunk);
      return;
    }

    const poll = async () => {
      if (resolved || instance.status !== 'starting') return;
      const open = await this.isPortListening(instance.port);
      if (open) {
        markReady();
        return;
      }
      setTimeout(poll, PREVIEW_START_POLL_MS);
    };
    void poll();
  }

  private async stopInstance(
    taskGroupId: string,
    instance: PreviewInstanceRuntime,
    options?: { keepStatus?: boolean; keepMessage?: boolean; message?: string }
  ): Promise<void> {
    // Terminate a single preview process with optional status/message preservation. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const nextStatus = options?.keepStatus ? instance.status : 'stopped';
    const nextMessage = options?.keepMessage ? instance.message : options?.message;
    if (!instance.process || instance.process.killed) {
      instance.status = nextStatus;
      instance.message = nextMessage;
      this.portPool.releasePort(taskGroupId, instance.port);
      return;
    }

    const proc = instance.process;
    instance.process = undefined;

    const killPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 3000);

      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });

      proc.kill('SIGTERM');
    });

    await killPromise;
    instance.status = nextStatus;
    instance.message = nextMessage;
    this.portPool.releasePort(taskGroupId, instance.port);
  }

  private async stopIdlePreviews(): Promise<void> {
    // Stop preview groups once all running instances exceed the idle timeout window. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const now = Date.now();
    const entries = Array.from(this.groups.entries());
    await Promise.all(
      entries.map(async ([groupId, runtime]) => {
        const runningInstances = runtime.instances.filter((instance) => instance.status === 'running');
        if (runningInstances.length === 0) return;
        const allIdle = runningInstances.every((instance) => now - instance.lastAccessAt > PREVIEW_IDLE_TIMEOUT_MS);
        if (!allIdle) return;
        runningInstances.forEach((instance) => {
          this.appendSystemLog(groupId, instance, 'idle timeout reached, stopping preview');
        });
        await this.stopPreview(groupId);
      })
    );
  }

  private resolveConfigPath(workspaceDir: string): string {
    // Centralize preview config path resolution for watcher setup. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    return path.join(workspaceDir, '.hookcode.yml');
  }

  private ensureConfigWatcher(taskGroupId: string, configPath: string): void {
    // Watch preview config changes to trigger hot reload restarts. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (this.configWatchers.has(taskGroupId)) return;
    try {
      const watcher = fs.watch(configPath, { persistent: false }, (eventType) => {
        if (eventType !== 'change' && eventType !== 'rename') return;
        this.scheduleConfigReload(taskGroupId);
      });
      watcher.on('error', (err) => {
        console.error('[preview] config watcher error', err);
      });
      this.configWatchers.set(taskGroupId, watcher);
    } catch (err) {
      console.error('[preview] config watcher failed', err);
    }
  }

  private clearConfigWatcher(taskGroupId: string): void {
    // Cleanup config watchers when previews stop. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const watcher = this.configWatchers.get(taskGroupId);
    if (!watcher) return;
    watcher.close();
    this.configWatchers.delete(taskGroupId);
  }

  private scheduleConfigReload(taskGroupId: string): void {
    // Debounce config reloads to avoid restart storms on rapid edits. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const existing = this.configReloadTimers.get(taskGroupId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.configReloadTimers.delete(taskGroupId);
      void this.reloadPreviewConfig(taskGroupId);
    }, PREVIEW_CONFIG_RELOAD_DEBOUNCE_MS);
    timer.unref?.();
    this.configReloadTimers.set(taskGroupId, timer);
  }

  private clearConfigReloadTimer(taskGroupId: string): void {
    // Ensure pending config reload timers don't fire after previews stop. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const existing = this.configReloadTimers.get(taskGroupId);
    if (!existing) return;
    clearTimeout(existing);
    this.configReloadTimers.delete(taskGroupId);
  }

  private clearAllConfigReloadTimers(): void {
    // Clear all pending config reload timers during shutdown. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    for (const timer of this.configReloadTimers.values()) {
      clearTimeout(timer);
    }
    this.configReloadTimers.clear();
  }

  private async reloadPreviewConfig(taskGroupId: string): Promise<void> {
    // Restart previews when .hookcode.yml changes, unless config is invalid. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const runtime = this.groups.get(taskGroupId);
    if (!runtime) return;

    let config: HookcodeConfig | null = null;
    try {
      config = await this.hookcodeConfigService.parseConfig(runtime.workspaceDir);
    } catch (err) {
      runtime.instances.forEach((instance) => {
        this.appendSystemLog(taskGroupId, instance, 'config reload skipped: invalid .hookcode.yml');
      });
      return;
    }

    if (!config?.preview?.instances?.length) {
      runtime.instances.forEach((instance) => {
        this.appendSystemLog(taskGroupId, instance, 'config reload skipped: preview not configured');
      });
      return;
    }

    runtime.instances.forEach((instance) => {
      this.appendSystemLog(taskGroupId, instance, 'config changed: restarting preview');
    });

    try {
      await this.startPreview(taskGroupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      runtime.instances.forEach((instance) => {
        this.appendSystemLog(taskGroupId, instance, `config reload failed: ${message}`);
      });
    }
  }

  private appendLog(taskGroupId: string, instance: PreviewInstanceRuntime, entry: PreviewLogEntry): void {
    // Maintain a capped in-memory log buffer and publish SSE events. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    instance.logs.push(entry);
    if (instance.logs.length > PREVIEW_LOG_BUFFER_MAX) {
      instance.logs.splice(0, instance.logs.length - PREVIEW_LOG_BUFFER_MAX);
    }
    this.previewLogStream.publish(PreviewLogStream.buildInstanceKey(taskGroupId, instance.config.name), entry);
  }

  private appendSystemLog(taskGroupId: string, instance: PreviewInstanceRuntime, message: string): void {
    // Emit structured system log entries for preview lifecycle updates. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.appendLog(taskGroupId, instance, {
      timestamp: new Date().toISOString(),
      level: 'system',
      message
    });
  }

  private attachLogStreaming(taskGroupId: string, instance: PreviewInstanceRuntime): void {
    // Stream preview process stdout/stderr into log buffers for SSE. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!instance.process) return;

    const stdoutBuffer = { value: '' };
    const stderrBuffer = { value: '' };
    const appendChunk = (level: 'stdout' | 'stderr', chunk: Buffer, bufferRef: { value: string }) => {
      bufferRef.value += chunk.toString('utf8');
      const parts = bufferRef.value.split(/\r?\n/);
      bufferRef.value = parts.pop() ?? '';
      for (const line of parts) {
        const message = line.trimEnd();
        if (!message) continue;
        this.appendLog(taskGroupId, instance, {
          timestamp: new Date().toISOString(),
          level,
          message
        });
      }
    };

    instance.process.stdout.on('data', (chunk: Buffer) => appendChunk('stdout', chunk, stdoutBuffer));
    instance.process.stderr.on('data', (chunk: Buffer) => appendChunk('stderr', chunk, stderrBuffer));
  }

  private async installDependenciesIfNeeded(workspaceDir: string, config: HookcodeConfig): Promise<DependencyResult | null> {
    // Run repository dependency installs before preview startup when configured. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    // Return the dependency result so manual reinstall calls can report status. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!config.dependency) return null;

    const logs: string[] = [];
    const appendLog = async (msg: string) => {
      if (logs.length < 200) logs.push(msg);
    };

    try {
      const result = await installDependencies({
        workspaceDir,
        config,
        runtimeService: this.runtimeService,
        appendLog,
        runCommand: async ({ command, cwd }) => {
          // Run preview dependency installs with explicit cwd for consistent workspace targeting. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
          const { stdout, stderr, exitCode } = await runCommandCapture(command, { env: process.env, cwd });
          const output = [stdout, stderr].filter(Boolean).join('\n');
          return { exitCode, output };
        }
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof DependencyInstallerError) {
        throw new PreviewServiceError(message, 'dependency_failed');
      }
      throw new PreviewServiceError(message, 'dependency_failed');
    }
  }

  private resolveInstanceWorkdir(repoDir: string, workdir: string): string {
    // Keep preview workdirs inside the repo checkout to avoid path traversal. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const trimmed = String(workdir ?? '').trim();
    if (!trimmed) return repoDir;
    if (path.isAbsolute(trimmed)) {
      throw new PreviewServiceError('preview workdir must be relative', 'instance_invalid');
    }
    const resolved = path.resolve(repoDir, trimmed);
    const relative = path.relative(repoDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new PreviewServiceError('preview workdir must stay within repo root', 'instance_invalid');
    }
    return resolved;
  }

  private renderCommand(command: string, port: number): string {
    // Allow optional {{PORT}} placeholder replacement for framework-specific commands. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    return String(command ?? '').replace(/\{\{\s*PORT\s*\}\}/g, String(port));
  }

  private async safeAllocatePort(taskGroupId: string): Promise<number> {
    try {
      return await this.portPool.allocatePort(taskGroupId);
    } catch (err) {
      throw new PreviewServiceError('no preview ports available', 'port_unavailable');
    }
  }


  private buildRuntimeSummary(taskGroupId: string, instance: PreviewInstanceRuntime): PreviewInstanceSummary {
    // Include diagnostics in status responses for failed/timeout preview instances. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const activePort = instance.status === 'running' || instance.status === 'starting' ? instance.port : undefined;
    return this.buildSummary(taskGroupId, instance.config, instance.status, {
      port: activePort,
      message: instance.message,
      diagnostics: this.buildDiagnostics(instance)
    });
  }

  private buildDiagnostics(instance: PreviewInstanceRuntime): PreviewDiagnostics | undefined {
    // Provide structured diagnostics when preview instances fail or time out. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (instance.status !== 'failed' && instance.status !== 'timeout') return undefined;
    const logs = instance.logs.slice(-PREVIEW_DIAGNOSTIC_LOG_TAIL);
    if (logs.length === 0 && instance.exitCode == null && instance.exitSignal == null) return undefined;
    return {
      exitCode: instance.exitCode ?? null,
      signal: instance.exitSignal ?? null,
      logs
    };
  }

  private buildSummary(
    taskGroupId: string,
    instance: PreviewInstanceConfig,
    status: PreviewInstanceStatus,
    extras?: { port?: number; message?: string; diagnostics?: PreviewDiagnostics }
  ): PreviewInstanceSummary {
    return {
      name: instance.name,
      status,
      port: extras?.port,
      message: extras?.message,
      diagnostics: extras?.diagnostics,
      path: `/preview/${taskGroupId}/${instance.name}/`,
      // Emit subdomain preview URLs when configured for production routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      publicUrl: buildPreviewPublicUrl(taskGroupId, instance.name)
    };
  }

  private async resolvePreviewConfig(
    taskGroupId: string,
    options?: { requireConfig?: boolean }
  ): Promise<
    | { available: true; workspaceDir: string; config: HookcodeConfig; snapshot: PreviewStatusSnapshot }
    | { available: false; workspaceDir?: string; config?: HookcodeConfig; snapshot: PreviewStatusSnapshot }
  > {
    // Resolve workspace + preview config in one pass for status/start calls. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const workspaceDir = await this.resolveWorkspaceDir(taskGroupId);
    // Map invalid preview configs to a status snapshot instead of throwing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    let hookcodeConfig: HookcodeConfig | null = null;
    try {
      hookcodeConfig = await this.hookcodeConfigService.parseConfig(workspaceDir);
    } catch {
      const snapshot: PreviewStatusSnapshot = {
        available: false,
        instances: [],
        reason: 'config_invalid'
      };
      return { available: false, workspaceDir, snapshot };
    }
    if (!hookcodeConfig || !hookcodeConfig.preview?.instances?.length) {
      const snapshot: PreviewStatusSnapshot = {
        available: false,
        instances: [],
        reason: 'config_missing'
      };
      if (options?.requireConfig) return { available: false, workspaceDir, snapshot };
      return { available: false, workspaceDir, snapshot };
    }

    const snapshot: PreviewStatusSnapshot = {
      available: true,
      instances: hookcodeConfig.preview.instances.map((instance) =>
        this.buildSummary(taskGroupId, instance, 'stopped')
      )
    };
    return { available: true, workspaceDir, config: hookcodeConfig, snapshot };
  }

  private async resolveWorkspaceDir(taskGroupId: string): Promise<string> {
    // Resolve the task-group workspace path from the latest task payload. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const group = await this.taskService.getTaskGroup(taskGroupId, { includeMeta: true });
    if (!group) throw new PreviewServiceError('task group not found', 'invalid_group');

    const tasks = await this.taskService.listTasksByGroup(taskGroupId, { limit: 20, includeMeta: false });
    if (tasks.length === 0) throw new PreviewServiceError('task group has no tasks', 'missing_task');

    const providerFallback = group.repoProvider ?? group.repo?.provider;
    let lastProvider = providerFallback ?? null;
    for (const task of tasks) {
      const provider = task.repoProvider ?? providerFallback;
      if (!provider) continue;
      lastProvider = provider;
      const repoSlug = getRepoSlug(provider, task.payload, task.id);
      const workspaceDir = buildTaskGroupWorkspaceDir({
        taskGroupId,
        taskId: task.id,
        provider,
        repoSlug
      });
      try {
        await access(workspaceDir, constants.F_OK);
        // Prefer the first task whose workspace exists to avoid payload regressions. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
        return workspaceDir;
      } catch {
        // Continue scanning tasks when the latest payload cannot resolve the workspace. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      }
    }

    // Fall back to the task-group root layout when payload data is incomplete. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const fallbackDir = await this.findWorkspaceByGroupRoot(taskGroupId);
    if (fallbackDir) return fallbackDir;

    throw new PreviewServiceError('task group workspace missing', 'workspace_missing');
  }

  private async findWorkspaceByGroupRoot(taskGroupId: string): Promise<string | null> {
    // Fallback to an existing repo directory under the task-group root when metadata is missing. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    const groupRoot = buildTaskGroupRootDir({ taskGroupId, taskId: taskGroupId });
    try {
      const entries = await readdir(groupRoot, { withFileTypes: true });
      // Ignore tooling directories like .codex when selecting repo roots. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      const candidates = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
      if (candidates.length === 0) return null;
      let selected: { dir: string; mtime: number } | null = null;
      for (const entry of candidates) {
        const dir = path.join(groupRoot, entry.name);
        const stats = await stat(dir);
        const mtime = Number(stats.mtimeMs ?? stats.mtime.getTime());
        if (!selected || mtime > selected.mtime) {
          selected = { dir, mtime };
        }
      }
      return selected?.dir ?? null;
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
  }

  private async isPortListening(port: number): Promise<boolean> {
    return await new Promise((resolve) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' });
      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        resolve(false);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }
}

export { PreviewServiceError };
