export {};

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return { ...actual, spawn: jest.fn() };
});

import path from 'path';
import { spawn } from 'child_process';
import { spawnPrismaStudio } from '../../adminTools/prismaStudioProxy';

describe('Prisma Studio（spawn 路径）', () => {
  const mockSpawn = spawn as unknown as jest.Mock;

  beforeEach(() => {
    mockSpawn.mockReset();
  });

  test('应从 backend/scripts/prisma-run.js 启动 Prisma Studio（cwd=backend）', async () => {
    const child = { pid: 123 } as any;
    mockSpawn.mockReturnValue(child);

    const upstreamPort = 5555;
    const hostname = '127.0.0.1';

    const result = await spawnPrismaStudio({ upstreamPort, hostname });

    const backendRoot = path.resolve(__dirname, '../../..');
    const prismaRunJs = path.join(backendRoot, 'scripts', 'prisma-run.js');

    expect(result).toBe(child);
    expect(mockSpawn).toHaveBeenCalledWith(
      process.execPath,
      [prismaRunJs, 'studio', '--hostname', hostname, '--port', String(upstreamPort), '--browser', 'none'],
      expect.objectContaining({ cwd: backendRoot })
    );
  });
});
