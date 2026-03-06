jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    repoMember: {
      findFirst: jest.fn()
    }
  }
}));

import { db } from '../../db';
import { RepoMemberService } from '../../modules/repositories/repo-member.service';

describe('RepoMemberService.getRepoCreator', () => {
  const service = new RepoMemberService({} as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when no owner membership exists', async () => {
    // Validate repo creator derivation remains safe when memberships are missing. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    (db.repoMember.findFirst as any).mockResolvedValueOnce(null);

    await expect(service.getRepoCreator('r1')).resolves.toBeNull();
  });

  test('returns the earliest owner membership user summary', async () => {
    // Ensure repo creator summary is extracted from the owner membership user join. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    (db.repoMember.findFirst as any).mockResolvedValueOnce({
      id: 'm1',
      repoId: 'r1',
      userId: 'u1',
      role: 'owner',
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      user: { id: 'u1', username: 'alice', displayName: 'Alice' }
    });

    await expect(service.getRepoCreator('r1')).resolves.toEqual({
      userId: 'u1',
      username: 'alice',
      displayName: 'Alice'
    });
  });
});

