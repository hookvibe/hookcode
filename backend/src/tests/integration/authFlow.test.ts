export {};

const dbUrl = String(process.env.DATABASE_URL_TEST || '').trim();
const describeDb = dbUrl ? describe : describe.skip;

const truncateAll = async () => {
  const { db } = await import('../../db');
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      email_verification_tokens,
      repo_automation_configs,
      repo_robots,
      repositories,
      users,
      tasks
    CASCADE;
  `);
};

describeDb('Auth flow (bootstrap + password login)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = dbUrl;
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_TOKEN_SECRET = 'test-secret';
    process.env.AUTH_TOKEN_TTL_SECONDS = '3600';
    process.env.AUTH_BOOTSTRAP_ADMIN = 'true';
    process.env.AUTH_ADMIN_USERNAME = 'admin';
    process.env.AUTH_ADMIN_PASSWORD = 'admin';

    const { ensureSchema } = await import('../../db');
    await ensureSchema();
    await truncateAll();

    const { UserService } = await import('../../modules/users/user.service');
    const userService = new UserService();
    await userService.ensureBootstrapAdmin();
  });

  afterAll(async () => {
    const { closeDb } = await import('../../db');
    await closeDb();
  });

  test('issues and verifies token for bootstrap user', async () => {
    const { UserService } = await import('../../modules/users/user.service');
    const userService = new UserService();
    const { issueToken, verifyToken } = await import('../../auth/authService');

    const user = await userService.verifyPassword('admin', 'admin');
    expect(user).not.toBeNull();

    const { token } = issueToken({ ...user!, roles: [] });
    expect(token).toContain('.');

    const payload = verifyToken(token);
    expect(payload.sub).toBe(user!.id);
  });

  test('registers user, logs in, and verifies token', async () => {
    const { UserService } = await import('../../modules/users/user.service');
    const userService = new UserService();
    const { issueToken, verifyToken } = await import('../../auth/authService');

    const created = await userService.createUser({
      username: 'bob@example.com',
      password: 'pass123',
      displayName: 'Bob'
    });
    expect(created.username).toBe('bob@example.com');

    const login = await userService.verifyPassword('bob@example.com', 'pass123');
    expect(login).not.toBeNull();
    expect(login?.id).toBe(created.id);

    const { token } = issueToken({ ...login!, roles: [] });
    const payload = verifyToken(token);
    expect(payload.sub).toBe(created.id);
  });
});
