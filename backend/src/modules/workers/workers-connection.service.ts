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

@Injectable()
export class WorkersConnectionService {
  private wss: WebSocketServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly sockets = new Map<string, WebSocket>();
  private readonly lastSeenAt = new Map<string, number>();

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

  sendPrepareRuntime(workerId: string, providers?: string[]): boolean {
    return this.send(workerId, { type: 'prepareRuntime', providers });
  }

  sendCancelTask(workerId: string, taskId: string): boolean {
    // Forward explicit stop requests to connected workers so long-running providers abort faster than the poll fallback. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return this.send(workerId, { type: 'cancelTask', taskId });
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
        if (message.type === 'runtimePrepareStarted') {
          this.lastSeenAt.set(workerId, Date.now());
          await this.workersService.markRuntimePreparing(workerId, message.providers);
          return;
        }
        if (message.type === 'runtimePrepareFinished') {
          this.lastSeenAt.set(workerId, Date.now());
          await this.workersService.markRuntimePrepared(workerId, message);
        }
      } catch (err) {
        console.error('[workers] ws message failed', err);
      }
    });

    ws.on('close', () => {
      if (this.sockets.get(workerId) === ws) {
        this.sockets.delete(workerId);
        this.lastSeenAt.delete(workerId);
        void this.workersService.markWorkerOffline(workerId, 'socket_closed');
      }
    });

    ws.on('error', (err) => {
      console.error('[workers] ws error', { workerId, error: err });
    });
  }
}
