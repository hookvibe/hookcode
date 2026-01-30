export {};

describe('AuthGuard PAT scope enforcement', () => {
  const buildReq = (method: string) => {
    const req: any = {
      method,
      headers: { authorization: 'Bearer hcpat_test' },
      header: (name: string) => (req.headers ?? {})[String(name).toLowerCase()]
    };
    return req;
  };

  const buildContext = (req: any) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req })
  });

  const buildReflector = (scopeGroup?: string) => ({
    getAllAndOverride: (key: string) => {
      if (key === 'hookcode:isPublic') return false;
      if (key === 'hookcode:isHealthCheck') return false;
      if (key === 'hookcode:allowQueryToken') return false;
      if (key === 'hookcode:authScopeGroup') return scopeGroup;
      if (key === 'hookcode:authScopeLevel') return undefined;
      return undefined;
    }
  });

  test('allows read-scoped PAT for GET requests', async () => {
    const prevAuthEnabled = process.env.AUTH_ENABLED;
    process.env.AUTH_ENABLED = 'true';

    try {
      jest.resetModules();
      const { AuthGuard } = await import('../../modules/auth/auth.guard');

      const guard = new AuthGuard(
        buildReflector('tasks') as any,
        {
          loadUser: jest.fn().mockResolvedValue({ id: 'u1', username: 'alice', roles: [] })
        } as any,
        {
          // Provide PAT auth context with read scope for tasks. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
          verifyToken: jest.fn().mockResolvedValue({
            auth: { tokenType: 'pat', sub: 'u1', iat: 0, scopes: { tasks: 'read' }, patId: 'p1' },
            userId: 'u1'
          })
        } as any
      );

      const req = buildReq('GET');
      const context = buildContext(req);
      await expect(guard.canActivate(context as any)).resolves.toBe(true);
    } finally {
      if (prevAuthEnabled === undefined) delete process.env.AUTH_ENABLED;
      else process.env.AUTH_ENABLED = prevAuthEnabled;
    }
  });

  test('blocks read-scoped PAT for write requests', async () => {
    const prevAuthEnabled = process.env.AUTH_ENABLED;
    process.env.AUTH_ENABLED = 'true';

    try {
      jest.resetModules();
      const { AuthGuard } = await import('../../modules/auth/auth.guard');
      const { HttpException } = await import('@nestjs/common');

      const guard = new AuthGuard(
        buildReflector('tasks') as any,
        {
          loadUser: jest.fn().mockResolvedValue({ id: 'u1', username: 'alice', roles: [] })
        } as any,
        {
          // Provide PAT auth context with read scope only. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
          verifyToken: jest.fn().mockResolvedValue({
            auth: { tokenType: 'pat', sub: 'u1', iat: 0, scopes: { tasks: 'read' }, patId: 'p1' },
            userId: 'u1'
          })
        } as any
      );

      const req = buildReq('POST');
      const context = buildContext(req);

      try {
        await guard.canActivate(context as any);
        throw new Error('expected canActivate to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as any).getStatus()).toBe(403);
      }
    } finally {
      if (prevAuthEnabled === undefined) delete process.env.AUTH_ENABLED;
      else process.env.AUTH_ENABLED = prevAuthEnabled;
    }
  });
});
