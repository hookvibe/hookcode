import type { RepoRobot } from '../../types/repoRobot';
import { detectRobotInText, selectRobotForTask } from '../../agent/robots';

const makeRobot = (partial: Partial<RepoRobot>): RepoRobot => ({
  id: partial.id ?? 'r1',
  repoId: partial.repoId ?? 'repo',
  name: partial.name ?? 'robot',
  permission: partial.permission ?? 'read',
  hasToken: partial.hasToken ?? false,
  enabled: partial.enabled ?? true,
  isDefault: partial.isDefault ?? false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  ...partial
});

describe('robot 选择逻辑', () => {
  test('detectRobotInText 命中 @name（大小写不敏感）', () => {
    const robots = [makeRobot({ name: 'HOOKCODE-REVIEW' })];
    const hit = detectRobotInText('pls @hookcode-review help', robots);
    expect(hit?.name).toBe('HOOKCODE-REVIEW');
  });

  test('detectRobotInText 支持 repoTokenUsername（name/username 任一命中）', () => {
    const robots = [makeRobot({ id: 'r1', name: 'build', repoTokenUsername: 'hookcode-build' })];
    const hit = detectRobotInText('pls @hookcode-build help', robots);
    expect(hit?.id).toBe('r1');
  });

  test('push 事件默认选择 read robot（忽略提交信息中的 @）', () => {
    const robots = [
      makeRobot({ id: 'read', name: 'r', permission: 'read', isDefault: true }),
      makeRobot({ id: 'write', name: 'w', permission: 'write', isDefault: true })
    ];

    const selected = selectRobotForTask(
      { eventType: 'push', title: 'Push · @w do it' } as any,
      { commits: [] },
      robots,
      { noteText: '@w' }
    );
    expect(selected?.id).toBe('read');
  });

  test('note 事件根据 @robot 选择', () => {
    const robots = [
      makeRobot({ id: 'read', name: 'r', permission: 'read', isDefault: true }),
      makeRobot({ id: 'write', name: 'w', permission: 'write', isDefault: true })
    ];

    const selected = selectRobotForTask(
      { eventType: 'note', title: 'x' } as any,
      {},
      robots,
      { noteText: 'please @w implement' }
    );
    expect(selected?.id).toBe('write');
  });

  test('issue 带 bug/feature 标签且存在 write robot 时，选择 write', () => {
    const robots = [
      makeRobot({ id: 'read', name: 'r', permission: 'read', isDefault: true }),
      makeRobot({ id: 'write', name: 'w', permission: 'write', isDefault: true })
    ];

    const selected = selectRobotForTask(
      { eventType: 'issue', title: 'x' } as any,
      { object_attributes: { labels: [{ title: 'bug' }] } },
      robots
    );
    expect(selected?.id).toBe('write');
  });

  test('issue 无匹配标签时选择 read', () => {
    const robots = [
      makeRobot({ id: 'read', name: 'r', permission: 'read', isDefault: true }),
      makeRobot({ id: 'write', name: 'w', permission: 'write', isDefault: true })
    ];

    const selected = selectRobotForTask(
      { eventType: 'issue', title: 'x' } as any,
      { object_attributes: { labels: [{ title: 'question' }] } },
      robots
    );
    expect(selected?.id).toBe('read');
  });
});
