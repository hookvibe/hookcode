import type { IncomingMessage } from 'http';
import { Injectable } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../../types/workerProtocol';
import { parsePositiveInt } from '../../utils/parse';
import { WorkersService } from './workers.service';

const WORKER_CONNECT_PATH = '/api/workers/connect';
const WORKER_HEARTBEAT_INTERVAL_MS = parsePositiveInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS, 10_000);
const WORKER_HEARTBEAT_TIMEOUT_MS = parsePositiveInt(process.env.WORKER_HEARTBEAT_TIMEOUT_MS, 30_000);
const WORKER_REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.WORKER_REQUEST_TIMEOUT_MS, 20_000);

type PendingWorkerRequest = {
  workerId: string;
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

@Injectable()
export class WorkersConnectionService {
  private wss: WebSocketServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly sockets = new Map<string, WebSocket>();
  private readonly lastSeenAt = new Map<string, number>();
  private readonly pendingRequests = new Map<string, PendingWorkerRequest>();

  constructor(private readonly workersService: WorkersService) {}

  attach(server: Server): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ noServer: true });
    if (!this.heartbeatTimer) {
      // Expire silent worker sockets so backend can fail stuck processing tasks when heartbeats stop arriving. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
      this.heartbeatTimer = setInterval(() => {
        void this.checkHeartbeatTimeouts();
      }, WORKER_HEARTBEAT_INTERVAL_MS);
    }
    server.on('upgrade', async (req, socket, head) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        if (url.pathname !== WORKER_CONNECT_PATH) return;
        const workerId = url.searchParams.get('workerId') || '';
        const token = url.searchParams.get('token') || '';
        const worker = await this.workersService.verifyWorkerToken(workerId, token);
        if (!worker) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        this.wss?.handleUpgrade(req, socket, head, (ws) => {
          this.handleConnection(worker.id, ws, req);
        });
      } catch (err) {
        console.error('[workers] ws upgrade failed', err);
        socket.destroy();
      }
    });
  }

  hasConnection(workerId: string): boolean {
    return this.sockets.has(workerId);
  }

  disconnect(workerId: string, reason = 'worker_disconnected'): void {
    const socket = this.sockets.get(workerId);
    if (!socket) return;
    this.sockets.delete(workerId);
    this.lastSeenAt.delete(workerId);
    this.rejectPendingRequestsForWorker(workerId, reason);
    try {
      socket.terminate();
    } catch {
      // ignore
    }
    void this.workersService.markWorkerOffline(workerId, reason);
  }

  send(workerId: string, payload: WorkerOutboundMessage): boolean {
    const socket = this.sockets.get(workerId);
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }

  sendAssignTask(workerId: string, taskId: string): boolean {
    // Dispatch claimed tasks over the worker control socket so execution starts immediately without polling. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return this.send(workerId, { type: 'assignTask', taskId });
  }

  sendCancelTask(workerId: string, taskId: string): boolean {
    // Forward explicit stop requests to connected workers so long-running providers abort faster than the poll fallback. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return this.send(workerId, { type: 'cancelTask', taskId });
  }

  async requestWorkspaceOperation(
    workerId: string,
    params: {
      taskId: string;
      action: 'snapshot' | 'stage' | 'unstage' | 'discard' | 'delete_untracked' | 'commit';
      payload?: { paths?: string[]; message?: string };
    }
  ): Promise<Record<string, unknown>> {
    const requestId = `${workerId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Worker workspace request timed out'));
      }, WORKER_REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { workerId, resolve, reject, timer });
      const sent = this.send(workerId, {
        type: 'workspaceRequest',
        requestId,
        taskId: params.taskId,
        action: params.action,
        payload: params.payload
      });
      if (sent) return;
      clearTimeout(timer);
      this.pendingRequests.delete(requestId);
      reject(new Error('Worker is not connected'));
    });
  }

  private rejectPendingRequestsForWorker(workerId: string, message: string): void {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      if (pending.workerId !== workerId) continue;
      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.reject(new Error(message));
    }
  }

  private resolveWorkspaceResponse(message: Extract<WorkerInboundMessage, { type: 'workspaceResponse' }>): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingRequests.delete(message.requestId);
    if (message.success) {
      pending.resolve((message.result ?? {}) as Record<string, unknown>);
      return;
    }
    pending.reject(new Error(String(message.error?.message ?? 'Worker workspace request failed')));
  }

  private touchWorker(workerId: string): void {
    this.lastSeenAt.set(workerId, Date.now());
  }

  private async checkHeartbeatTimeouts(): Promise<void> {
    const now = Date.now();
    for (const [workerId, socket] of this.sockets.entries()) {
      const lastSeenAt = this.lastSeenAt.get(workerId) ?? 0;
      if (now - lastSeenAt <= WORKER_HEARTBEAT_TIMEOUT_MS) continue;
      this.sockets.delete(workerId);
      this.lastSeenAt.delete(workerId);
      this.rejectPendingRequestsForWorker(workerId, 'Worker heartbeat timed out');
      try {
        socket.terminate();
      } catch {
        // ignore
      }
      await this.workersService.markWorkerOffline(workerId, 'heartbeat_timeout');
    }
  }

  private handleConnection(workerId: string, ws: WebSocket, _req: IncomingMessage): void {
    const existing = this.sockets.get(workerId);
    if (existing && existing !== ws) {
      try {
        existing.close();
      } catch {
        // ignore
      }
    }
    this.sockets.set(workerId, ws);
    this.touchWorker(workerId);
    this.lastSeenAt.set(workerId, Date.now());

    ws.on('message', async (raw) => {
      try {
        const message = JSON.parse(String(raw)) as WorkerInboundMessage;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'hello') {
          this.lastSeenAt.set(workerId, Date.now());
          await this.workersService.markWorkerOnline(workerId, message);
          return;
        }
        if (message.type === 'heartbeat') {
          this.lastSeenAt.set(workerId, Date.now());
          await this.workersService.recordHeartbeat(workerId, message);
          return;
        }
        if (message.type === 'taskAccepted') {
          this.lastSeenAt.set(workerId, Date.now());
          await this.workersService.recordTaskAccepted(workerId, message.taskId);
          return;
        }
        if (message.type === 'workspaceResponse') {
          this.lastSeenAt.set(workerId, Date.now());
          this.resolveWorkspaceResponse(message);
        }
      } catch (err) {
        console.error('[workers] ws message failed', err);
      }
    });

    ws.on('close', () => {
      if (this.sockets.get(workerId) === ws) {
        this.sockets.delete(workerId);
        this.lastSeenAt.delete(workerId);
        this.rejectPendingRequestsForWorker(workerId, 'Worker connection closed');
        void this.workersService.markWorkerOffline(workerId, 'socket_closed');
      }
    });

    ws.on('error', (err) => {
      console.error('[workers] ws error', { workerId, error: err });
    });
  }
}
