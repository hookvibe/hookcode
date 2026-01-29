import { createServer } from 'net';

// Manage preview ports for task-group dev servers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export class PreviewPortPool {
  private readonly inUse = new Set<number>();
  private readonly allocations = new Map<string, number[]>();

  constructor(private readonly startPort = 10000, private readonly endPort = 10999) {}

  async allocatePort(taskGroupId: string): Promise<number> {
    // Allocate the next available port for a task group preview instance. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const port = await this.findAvailablePort();
    this.inUse.add(port);
    const list = this.allocations.get(taskGroupId) ?? [];
    list.push(port);
    this.allocations.set(taskGroupId, list);
    return port;
  }

  releasePort(taskGroupId: string, port: number): void {
    // Release a port and detach it from the owning task group. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    this.inUse.delete(port);
    const list = this.allocations.get(taskGroupId);
    if (!list) return;
    const next = list.filter((value) => value !== port);
    if (next.length) {
      this.allocations.set(taskGroupId, next);
    } else {
      this.allocations.delete(taskGroupId);
    }
  }

  releaseTaskGroup(taskGroupId: string): void {
    // Release all ports reserved for a task group preview session. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const list = this.allocations.get(taskGroupId);
    if (!list) return;
    list.forEach((port) => this.inUse.delete(port));
    this.allocations.delete(taskGroupId);
  }

  private async findAvailablePort(): Promise<number> {
    // Scan the configured range and return the first available port. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    for (let port = this.startPort; port <= this.endPort; port += 1) {
      if (this.inUse.has(port)) continue;
      const available = await this.isPortAvailable(port);
      if (available) return port;
    }
    throw new Error('no_available_preview_ports');
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    // Probe port availability by attempting a short-lived bind. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    return await new Promise((resolve) => {
      const server = createServer();
      server.unref();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });
  }
}
