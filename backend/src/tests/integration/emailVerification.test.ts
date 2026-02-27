export {};

const dbUrl = String(process.env.DATABASE_URL_TEST || '').trim();
const describeDb = dbUrl ? describe : describe.skip;

// Reset tables touched by email verification flows. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
const truncateAll = async () => {
  const { db } = await import('../../db');
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      email_verification_tokens,
      repo_member_invites,
      repo_members,
      repo_automation_configs,
      repo_robots,
      repositories,
      users,
      tasks
    CASCADE;
  `);
};

// Validate email verification token lifecycle against the database. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
describeDb('Email verification (DB integration)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = dbUrl;
    process.env.NODE_ENV = 'test';

    const { ensureSchema } = await import('../../db');
    await ensureSchema();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    const { closeDb } = await import('../../db');
    await closeDb();
  });

  test('verifyToken marks user as verified', async () => {
    // Create token + verify to update user emailVerifiedAt. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    const { db } = await import('../../db');
    const { UserService } = await import('../../modules/users/user.service');
    const { EmailVerificationService } = await import('../../modules/auth/email-verification.service');

    const userService = new UserService();
    const emailService = new EmailVerificationService();

    const user = await userService.createUser({
      username: 'verify-user',
      email: 'verify@example.com',
      password: 'pass123',
      emailVerifiedAt: null
    });

    const { token } = await emailService.createToken({ userId: user.id, email: user.email! });
    const result = await emailService.verifyToken({ email: user.email!, token });
    emailService.ensureVerified(result);

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated?.emailVerifiedAt).not.toBeNull();
  });
});
