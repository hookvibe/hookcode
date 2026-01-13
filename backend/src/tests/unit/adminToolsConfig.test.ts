export {};

import { loadAdminToolsConfig } from '../../adminTools/config';

describe('Admin Tools（配置）', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('默认 Prisma 端口为 7215', () => {
    delete process.env.ADMIN_TOOLS_PRISMA_PORT;
    const cfg = loadAdminToolsConfig();
    expect(cfg.prismaPort).toBe(7215);
  });

  test('支持读取 ADMIN_TOOLS_PRISMA_PORT', () => {
    process.env.ADMIN_TOOLS_PRISMA_PORT = '9001';
    const cfg = loadAdminToolsConfig();
    expect(cfg.prismaPort).toBe(9001);
  });

  test('默认 Swagger 端口为 7216', () => {
    delete process.env.ADMIN_TOOLS_SWAGGER_PORT;
    const cfg = loadAdminToolsConfig();
    expect(cfg.swaggerPort).toBe(7216);
  });

  test('支持读取 ADMIN_TOOLS_SWAGGER_PORT', () => {
    process.env.ADMIN_TOOLS_SWAGGER_PORT = '9002';
    const cfg = loadAdminToolsConfig();
    expect(cfg.swaggerPort).toBe(9002);
  });
});
