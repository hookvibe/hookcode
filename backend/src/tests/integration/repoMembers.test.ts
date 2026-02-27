export {};

import { randomUUID } from 'crypto';

const dbUrl = String(process.env.DATABASE_URL_TEST || '').trim();
const describeDb = dbUrl ? describe : describe.skip;

// Reset tables touched by repo member/invite flows. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
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

// Validate repo member/invite flows against the database. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
describeDb('Repo members + invites (DB integration)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = dbUrl;
    process.env.NODE_ENV = 'test';
    process.env.HOOKCODE_CONSOLE_BASE_URL = 'http://localhost:3000';

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

  test('listMembers returns seeded memberships', async () => {
    // Seed repo members and verify list output. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    const { UserService } = await import('../../modules/users/user.service');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const { RepoMemberService } = await import('../../modules/repositories/repo-member.service');

    const userService = new UserService();
    const repositoryService = new RepositoryService();
    const repoMemberService = new RepoMemberService(userService);

    const owner = await userService.createUser({
      username: 'owner',
      email: 'owner@example.com',
      password: 'pass123'
    });
    const member = await userService.createUser({
      username: 'member',
      email: 'member@example.com',
      password: 'pass123'
    });

    const repo = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'team-repo' });
    await repoMemberService.addMember({ repoId: repo.repo.id, userId: owner.id, role: 'owner' });
    await repoMemberService.addMember({ repoId: repo.repo.id, userId: member.id, role: 'member' });

    const members = await repoMemberService.listMembers(repo.repo.id);
    const roles = members.map((row) => row.role);
    expect(roles).toEqual(expect.arrayContaining(['owner', 'member']));
  });

  test('createInvite stores pending invite', async () => {
    // Create a pending invite and validate the stored payload. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    const { UserService } = await import('../../modules/users/user.service');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const { RepoMemberService } = await import('../../modules/repositories/repo-member.service');

    const userService = new UserService();
    const repositoryService = new RepositoryService();
    const repoMemberService = new RepoMemberService(userService);

    const owner = await userService.createUser({
      username: 'owner2',
      email: 'owner2@example.com',
      password: 'pass123'
    });
    const repo = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'invite-repo' });

    const invite = await repoMemberService.createInvite({
      repoId: repo.repo.id,
      invitedByUserId: owner.id,
      email: 'invitee@example.com',
      role: 'member'
    });

    expect(invite.repoId).toBe(repo.repo.id);
    expect(invite.email).toBe('invitee@example.com');
  });

  test('acceptInvite creates membership', async () => {
    // Accept an invite token and ensure membership is created. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    const { db } = await import('../../db');
    const { UserService } = await import('../../modules/users/user.service');
    const { RepositoryService } = await import('../../modules/repositories/repository.service');
    const { RepoMemberService } = await import('../../modules/repositories/repo-member.service');
    const { generateToken, hashToken } = await import('../../utils/token');

    const userService = new UserService();
    const repositoryService = new RepositoryService();
    const repoMemberService = new RepoMemberService(userService);

    const owner = await userService.createUser({
      username: 'owner3',
      email: 'owner3@example.com',
      password: 'pass123'
    });
    const invitee = await userService.createUser({
      username: 'invitee',
      email: 'invitee@example.com',
      password: 'pass123'
    });
    const repo = await repositoryService.createRepository({ id: owner.id }, { provider: 'gitlab', name: 'accept-repo' });

    const token = generateToken();
    const tokenHash = hashToken(token);
    const now = new Date();
    await db.repoMemberInvite.create({
      data: {
        id: randomUUID(),
        repoId: repo.repo.id,
        email: invitee.email!,
        emailLower: invitee.email!.toLowerCase(),
        role: 'maintainer',
        tokenHash,
        invitedByUserId: owner.id,
        invitedUserId: invitee.id,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now
      }
    });

    const repoId = await repoMemberService.acceptInvite({ token, email: invitee.email!, userId: invitee.id });
    expect(repoId).toBe(repo.repo.id);

    const membership = await db.repoMember.findUnique({
      where: { repoId_userId: { repoId: repo.repo.id, userId: invitee.id } }
    });
    expect(membership?.role).toBe('maintainer');
  });
});
