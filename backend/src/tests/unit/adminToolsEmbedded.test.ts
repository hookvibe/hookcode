export {};

import { isAdminToolsEmbeddedEnabled } from '../../adminTools/config';

describe('Admin Tools（内嵌启动开关）', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('默认启用（未设置 ADMIN_TOOLS_EMBEDDED）', () => {
    delete process.env.ADMIN_TOOLS_EMBEDDED;
    expect(isAdminToolsEmbeddedEnabled()).toBe(true);
  });

  test('ADMIN_TOOLS_EMBEDDED=false 时关闭', () => {
    process.env.ADMIN_TOOLS_EMBEDDED = 'false';
    expect(isAdminToolsEmbeddedEnabled()).toBe(false);
  });
});

