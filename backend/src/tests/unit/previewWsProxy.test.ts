import net from 'net';
import type { IncomingMessage, Server } from 'http';
import { PreviewWsProxyService } from '../../modules/tasks/preview-ws-proxy.service';

// Validate PreviewWsProxyService upgrade proxying without binding real localhost sockets. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa

type MockSocket = {
  pipe: jest.Mock<unknown, [unknown]>;
  on: jest.Mock<MockSocket, [string, (...args: any[]) => void]>;
  write: jest.Mock<void, [unknown]>;
  destroy: jest.Mock<void, []>;
  emit: (event: string, ...args: any[]) => void;
};

const createMockSocket = (): MockSocket => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const socket = {} as MockSocket;
  socket.pipe = jest.fn((target: unknown) => target);
  socket.on = jest.fn((event: string, handler: (...args: any[]) => void) => {
    handlers.set(event, handler);
    return socket;
  });
  socket.write = jest.fn();
  socket.destroy = jest.fn();
  socket.emit = (event: string, ...args: any[]) => {
    handlers.get(event)?.(...args);
  };
  return socket;
};

describe('PreviewWsProxyService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rewrites upgrade requests and wires client/upstream piping for the preview instance', async () => {
    const previewService = {
      getProxyTarget: jest.fn(() => ({ port: 3010, status: 'running' })),
      touchInstanceAccess: jest.fn()
    };
    const proxyService = new PreviewWsProxyService(previewService as any, { loadUser: jest.fn() } as any);
    jest.spyOn(proxyService as any, 'authenticate').mockResolvedValue(true);

    const server = { on: jest.fn() } as unknown as Server;
    proxyService.attach(server);
    expect(server.on).toHaveBeenCalledWith('upgrade', expect.any(Function));

    const upstreamSocket = createMockSocket();
    const clientSocket = createMockSocket();
    // Replace real localhost sockets with in-memory mocks so WS proxy tests stay sandbox-safe. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    const connectSpy = jest.spyOn(net, 'connect').mockImplementation(((port: number, host: string, listener?: () => void) => {
      setImmediate(() => listener?.());
      return upstreamSocket as any;
    }) as any);
    const req = {
      method: 'GET',
      httpVersion: '1.1',
      headers: {
        host: 'example.test',
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-key': 'test-key',
        'sec-websocket-version': '13'
      },
      url: '/preview/group-1/frontend/?token=test'
    } as IncomingMessage;
    const head = Buffer.from('head');

    await (proxyService as any).handleUpgrade(req, clientSocket as any, head);
    await new Promise((resolve) => setImmediate(resolve));

    expect(connectSpy).toHaveBeenCalledWith(3010, '127.0.0.1', expect.any(Function));
    expect(previewService.getProxyTarget).toHaveBeenCalledWith('group-1', 'frontend');
    expect(previewService.touchInstanceAccess).toHaveBeenCalledWith('group-1', 'frontend', 'ws');
    expect(clientSocket.pipe).toHaveBeenCalledWith(upstreamSocket);
    expect(upstreamSocket.pipe).toHaveBeenCalledWith(clientSocket);
    expect(upstreamSocket.write).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('GET /?token=test HTTP/1.1')
    );
    expect(upstreamSocket.write).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('host: 127.0.0.1:3010')
    );
    expect(upstreamSocket.write).toHaveBeenNthCalledWith(2, head);
  });
});
