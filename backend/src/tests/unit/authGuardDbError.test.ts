export {};

describe('AuthGuard', () => {
  test('returns 503 when user loader throws', async () => {
    const prevAuthEnabled = process.env.AUTH_ENABLED;
    const prevSecret = process.env.AUTH_TOKEN_SECRET;

    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_TOKEN_SECRET = 'test-secret';

    try {
      jest.resetModules();
      const { HttpException } = await import('@nestjs/common');
      const { issueToken } = await import('../../auth/authService');
      const { AuthGuard } = await import('../../modules/auth/auth.guard');

      const token = issueToken({ id: 'u1', username: 'alice', roles: [] }).token;

      const guard = new AuthGuard(
        {
          getAllAndOverride: jest.fn().mockReturnValue(false)
        } as any,
        {
          loadUser: jest.fn().mockRejectedValue(new Error('db down'))
        } as any,
        {
          // Stub PAT verification for AuthGuard constructor signature. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
          verifyToken: jest.fn()
        } as any
      );

      const req: any = {
        headers: { authorization: `Bearer ${token}` },
        header: (name: string) => (req.headers ?? {})[String(name).toLowerCase()]
      };
      const context: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => req })
      };

      try {
        await guard.canActivate(context);
        throw new Error('expected canActivate to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as any).getStatus()).toBe(503);
      }
    } finally {
      if (prevAuthEnabled === undefined) delete process.env.AUTH_ENABLED;
      else process.env.AUTH_ENABLED = prevAuthEnabled;

      if (prevSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
      else process.env.AUTH_TOKEN_SECRET = prevSecret;
    }
  });
});
