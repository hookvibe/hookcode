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

describeDb('Repository + Robot config (DB integration)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = dbUrl;
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

  test('listAll returns created repositories', async () => {
    const { UserService } = await import('../../modules/users/user.service');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');

    const userService = new UserService();
    const repositoryService = new RepositoryService();

    const alice = await userService.createUser({
      username: 'alice',
      password: 'pass123'
    });
    const bob = await userService.createUser({
      username: 'bob',
      password: 'pass123'
    });

    await repositoryService.createRepository({ id: alice.id }, { provider: 'gitlab', name: 'alice-repo' });
    await repositoryService.createRepository({ id: bob.id }, { provider: 'github', name: 'bob-repo' });

    const repos = await repositoryService.listAll();
    const names = repos.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['alice-repo', 'bob-repo']));
  });

  test('setDefaultRobot keeps a single default robot per permission', async () => {
    const { UserService } = await import('../../modules/users/user.service');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const { RepoRobotService } = await import('../../modules/repositories/repo-robot.service');

    const userService = new UserService();
    const repositoryService = new RepositoryService();
    const repoRobotService = new RepoRobotService();

    const owner = await userService.createUser({
      username: 'owner',
      password: 'pass123'
    });
    const created = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'owner-repo' });

    const r1 = await repoRobotService.createRobot(
      { id: owner.id },
      created.repo.id,
      { name: 'r1', promptDefault: 'PROMPT', isDefault: true }
    );
    const r2 = await repoRobotService.createRobot(
      { id: owner.id },
      created.repo.id,
      { name: 'r2', promptDefault: 'PROMPT', isDefault: false }
    );

    await repoRobotService.setDefaultRobot(created.repo.id, r2.id);
    const robots = await repoRobotService.listByRepo(created.repo.id);
    const readRobots = robots.filter((r) => r.permission === 'read');
    expect(readRobots.filter((r) => r.isDefault)).toHaveLength(1);
    expect(readRobots.find((r) => r.id === r2.id)?.isDefault).toBe(true);
    expect(readRobots.find((r) => r.id === r1.id)?.isDefault).toBe(false);
  });
});
