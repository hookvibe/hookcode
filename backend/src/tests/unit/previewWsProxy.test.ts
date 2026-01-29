import http from 'http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { PreviewWsProxyService } from '../../modules/tasks/preview-ws-proxy.service';

// Validate PreviewWsProxyService upgrade proxying with a real WebSocket echo. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as

const listen = (server: http.Server): Promise<number> =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        resolve(0);
        return;
      }
      resolve(address.port);
    });
  });

const closeServer = (server: http.Server): Promise<void> =>
  new Promise((resolve) => {
    server.close(() => resolve());
  });

describe('PreviewWsProxyService', () => {
  const originalAuthEnabled = process.env.AUTH_ENABLED;

  beforeEach(() => {
    process.env.AUTH_ENABLED = 'false';
  });

  afterEach(() => {
    if (originalAuthEnabled === undefined) {
      delete process.env.AUTH_ENABLED;
    } else {
      process.env.AUTH_ENABLED = originalAuthEnabled;
    }
  });

  test('proxies WebSocket traffic to the preview instance', async () => {
    const upstreamServer = http.createServer();
    const upstreamWss = new WebSocketServer({ server: upstreamServer });
    upstreamWss.on('connection', (socket: WebSocket) => {
      socket.on('message', (data: RawData) => {
        socket.send(data);
      });
    });

    const upstreamPort = await listen(upstreamServer);

    const previewService = {
      getProxyTarget: jest.fn(() => ({ port: upstreamPort, status: 'running' })),
      touchInstanceAccess: jest.fn()
    };
    const proxyService = new PreviewWsProxyService(previewService as any, { loadUser: jest.fn() } as any);

    const proxyServer = http.createServer();
    proxyService.attach(proxyServer);
    const proxyPort = await listen(proxyServer);

    const echoed = await new Promise<string>((resolve, reject) => {
      const client = new WebSocket(`ws://127.0.0.1:${proxyPort}/preview/group-1/frontend/`);
      const timer = setTimeout(() => reject(new Error('timeout')), 3000);

      client.on('open', () => {
        client.send('ping');
      });
      client.on('message', (data: RawData) => {
        clearTimeout(timer);
        client.close();
        resolve(data.toString());
      });
      client.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(echoed).toBe('ping');
    expect(previewService.getProxyTarget).toHaveBeenCalledWith('group-1', 'frontend');
    expect(previewService.touchInstanceAccess).toHaveBeenCalled();

    await new Promise<void>((resolve) => upstreamWss.close(() => resolve()));
    await closeServer(proxyServer);
    await closeServer(upstreamServer);
  });
});
