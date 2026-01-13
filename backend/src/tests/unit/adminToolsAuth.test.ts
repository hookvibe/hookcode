export {};

import { Test } from '@nestjs/testing';
import { createOpenApiSpec } from '../../adminTools/openapi';
import { authenticateAdminTools, extractAdminToolsToken, parseCookieHeader } from '../../adminTools/auth';

describe('Admin Tools（鉴权/配置）', () => {
  beforeAll(() => {
    process.env.AUTH_TOKEN_SECRET = 'test-secret';
  });

  test('parseCookieHeader 能解析并 decode', () => {
    const parsed = parseCookieHeader('a=1; b=hello%20world; c=%7B%22k%22%3A1%7D');
    expect(parsed).toEqual({ a: '1', b: 'hello world', c: '{"k":1}' });
  });

  test('extractAdminToolsToken 支持 bearer/x-hookcode-token/cookie', () => {
    const req1 = {
      header: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer t1' : undefined),
      query: {}
    } as any;
    expect(extractAdminToolsToken(req1)).toBe('t1');

    const req2 = {
      header: (name: string) => (name.toLowerCase() === 'x-hookcode-token' ? 't2' : undefined),
      query: {}
    } as any;
    expect(extractAdminToolsToken(req2)).toBe('t2');

    const req3 = {
      header: (name: string) => (name.toLowerCase() === 'cookie' ? 'hookcode_admin_tools_token=t4' : undefined),
      query: {}
    } as any;
    expect(extractAdminToolsToken(req3)).toBe('t4');
  });

  test('authenticateAdminTools：缺 token 返回 401；disabled user 返回 401；有效 token 通过', async () => {
    const { issueToken, verifyToken } = await import('../../auth/authService');

    const adminUser = { id: 'u-admin', username: 'admin', roles: ['admin'] as string[] };
    const normalUser = { id: 'u-user', username: 'alice', roles: ['user'] as string[] };
    const disabledUser = { id: 'u-disabled', username: 'bob', roles: ['user'] as string[] };

    const getUserById = async (id: string) => {
      if (id === adminUser.id) return { id: adminUser.id, username: adminUser.username, disabled: false };
      if (id === normalUser.id) return { id: normalUser.id, username: normalUser.username, disabled: false };
      if (id === disabledUser.id) return { id: disabledUser.id, username: disabledUser.username, disabled: true };
      return null;
    };

    const missing = await authenticateAdminTools({ header: () => undefined, query: {} } as any, {
      verifyToken,
      getUserById
    });
    expect(missing.ok).toBe(false);
    expect((missing as any).status).toBe(401);

    const { token: userToken } = issueToken(normalUser as any);
    const okUser = await authenticateAdminTools(
      { header: (name: string) => (name.toLowerCase() === 'authorization' ? `Bearer ${userToken}` : undefined), query: {} } as any,
      { verifyToken, getUserById }
    );
    expect(okUser.ok).toBe(true);

    const { token: adminToken } = issueToken(adminUser as any);
    const ok = await authenticateAdminTools(
      { header: (name: string) => (name.toLowerCase() === 'authorization' ? `Bearer ${adminToken}` : undefined), query: {} } as any,
      { verifyToken, getUserById }
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.ctx.user.id).toBe(adminUser.id);
    }

    const { token: disabledToken } = issueToken(disabledUser as any);
    const disabled = await authenticateAdminTools(
      { header: (name: string) => (name.toLowerCase() === 'authorization' ? `Bearer ${disabledToken}` : undefined), query: {} } as any,
      { verifyToken, getUserById }
    );
    expect(disabled.ok).toBe(false);
    expect((disabled as any).status).toBe(401);
  });

  test('createOpenApiSpec 会写入 servers[0].url', async () => {
    const mod = await Test.createTestingModule({}).compile();
    const app = mod.createNestApplication();
    const spec = createOpenApiSpec({ apiBaseUrl: 'http://example.com/api', app });
    await app.close();
    expect((spec as any).servers?.[0]?.url).toBe('http://example.com/api');
  });
});
