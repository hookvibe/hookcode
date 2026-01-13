import { resolveAutomationActions } from '../../services/automationEngine';
import type { RepoRobot } from '../../types/repoRobot';
import type { RepoAutomationConfig } from '../../types/automation';

const robotA: RepoRobot = {
  id: 'r-a',
  repoId: 'repo-1',
  name: 'robot-a',
  permission: 'read',
  hasToken: false,
  repoTokenUsername: undefined,
  repoTokenUserName: undefined,
  promptDefault: 'BASE_A {{repo.name}} {{robot.name}}',
  enabled: true,
  isDefault: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

const robotB: RepoRobot = {
  id: 'r-b',
  repoId: 'repo-1',
  name: 'robot-b',
  permission: 'read',
  hasToken: false,
  repoTokenUsername: undefined,
  repoTokenUserName: undefined,
  promptDefault: 'BASE_B',
  enabled: true,
  isDefault: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

const baseConfig = (): RepoAutomationConfig => ({
  version: 2,
  events: {
    issue: { enabled: true, rules: [] },
    commit: { enabled: true, rules: [] },
    merge_request: { enabled: true, rules: [] }
  }
});

describe('automationEngine.resolveAutomationActions', () => {
  test('issue（created）：按负责人匹配并生成 promptCustom（默认模板 + 微调）', () => {
    const config = baseConfig();
    config.events.issue!.rules = [
      {
        id: 'rule-a',
        name: 'assignee robot-a',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['created'] },
            {
              field: 'issue.assignees',
              op: 'containsAny',
              values: ['robot-a']
            }
          ]
        },
        actions: [
          {
            id: 'act-a',
            robotId: robotA.id,
            enabled: true,
            promptPatch: 'PATCH_A'
          }
        ]
      }
    ];

    const payload = {
      __subType: 'created',
      object_attributes: {
        assignees: [{ username: 'robot-a' }]
      }
    };

    const actions = resolveAutomationActions({
      eventType: 'issue',
      payload,
      robots: [robotA, robotB],
      config,
      repo: null
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].robotId).toBe(robotA.id);
    expect(actions[0].promptCustom).toBe('BASE_A {{repo.name}} {{robot.name}}\n\nPATCH_A');
  });

  test('issue（commented）：按 @mention 匹配多个机器人', () => {
    const config = baseConfig();
    config.events.issue!.rules = [
      {
        id: 'rule-a',
        name: '@robot-a',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['commented'] },
            { field: 'comment.mentions', op: 'containsAny', values: ['@robot-a'] }
          ]
        },
        actions: [{ id: 'act-a', robotId: robotA.id, enabled: true }]
      },
      {
        id: 'rule-b',
        name: '@robot-b',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['commented'] },
            { field: 'comment.mentions', op: 'containsAny', values: ['@robot-b'] }
          ]
        },
        actions: [{ id: 'act-b', robotId: robotB.id, enabled: true, promptOverride: 'OVERRIDE_B' }]
      }
    ];

    const payload = {
      __subType: 'commented',
      object_attributes: {
        note: 'pls check @robot-a and @robot-b'
      }
    };

    const actions = resolveAutomationActions({
      eventType: 'issue',
      payload,
      robots: [robotA, robotB],
      config,
      repo: null
    });

    expect(actions.map((a) => a.robotId).sort()).toEqual([robotA.id, robotB.id].sort());
    const a = actions.find((x) => x.robotId === robotA.id)!;
    const b = actions.find((x) => x.robotId === robotB.id)!;
    expect(a.promptCustom).toBe('BASE_A {{repo.name}} {{robot.name}}');
    expect(b.promptCustom).toBe('OVERRIDE_B');
  });

  test('issue（commented）：支持 comment.mentionRobotIds（robot.name 与 repoTokenUsername 都可触发）', () => {
    const robots: RepoRobot[] = [
      {
        ...robotA,
        name: 'build',
        repoTokenUsername: 'hookcode-build',
        repoTokenUserName: 'hookcode build'
      }
    ];

    const config = baseConfig();
    config.events.issue!.rules = [
      {
        id: 'rule-a',
        name: '@build',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['commented'] },
            { field: 'comment.mentionRobotIds', op: 'containsAny', values: ['r-a'] }
          ]
        },
        actions: [{ id: 'act-a', robotId: 'r-a', enabled: true }]
      }
    ];

    const payload = { __subType: 'commented', object_attributes: { note: 'pls @hookcode-build run' } };
    const actions = resolveAutomationActions({
      eventType: 'issue',
      payload,
      robots,
      config,
      repo: null
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].robotId).toBe('r-a');
  });

  test('issue（commented）：legacy comment.mentions 支持 name/username 混淆（空格/符号归一化）', () => {
    const config = baseConfig();
    config.events.issue!.rules = [
      {
        id: 'rule-a',
        name: '@hookcode build',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['commented'] },
            { field: 'comment.mentions', op: 'containsAny', values: ['@hookcode build'] }
          ]
        },
        actions: [{ id: 'act-a', robotId: robotA.id, enabled: true }]
      }
    ];

    const payload = { __subType: 'commented', object_attributes: { note: 'pls @hookcode-build run' } };
    const actions = resolveAutomationActions({
      eventType: 'issue',
      payload,
      robots: [robotA],
      config,
      repo: null
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].robotId).toBe(robotA.id);
  });

  test('commit（created）：按 branch.name 匹配，且同一 robot 只取首个匹配规则', () => {
    const config = baseConfig();
    config.events.commit!.rules = [
      {
        id: 'rule-1',
        name: 'dev',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['created'] },
            { field: 'branch.name', op: 'matchesAny', values: ['dev'] }
          ]
        },
        actions: [{ id: 'act-1', robotId: robotA.id, enabled: true, promptPatch: 'DEV_PATCH' }]
      },
      {
        id: 'rule-2',
        name: 'catch-all',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['created'] },
            { field: 'push.branch', op: 'matchesAny', values: ['*'] }
          ]
        },
        actions: [{ id: 'act-2', robotId: robotA.id, enabled: true, promptPatch: 'SHOULD_NOT_APPLY' }]
      }
    ];

    const payload = { __subType: 'created', ref: 'refs/heads/dev' };

    const actions = resolveAutomationActions({
      eventType: 'commit',
      payload,
      robots: [robotA],
      config,
      repo: null
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].robotId).toBe(robotA.id);
    expect(actions[0].promptCustom).toBe('BASE_A {{repo.name}} {{robot.name}}\n\nDEV_PATCH');
    expect(actions[0].ruleId).toBe('rule-1');
  });

  test('commit（created）：支持 textContainsAny + negate 做关键词屏蔽', () => {
    const config = baseConfig();
    config.events.commit!.rules = [
      {
        id: 'rule-1',
        name: 'ignore ci',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['created'] },
            { field: 'text.all', op: 'textContainsAny', values: ['ci'], negate: true }
          ]
        },
        actions: [{ id: 'act-1', robotId: robotA.id, enabled: true }]
      }
    ];

    const payload = {
      __subType: 'created',
      ref: 'refs/heads/dev',
      commits: [{ message: 'ci: bump version' }]
    };

    const actions = resolveAutomationActions({
      eventType: 'commit',
      payload,
      robots: [robotA],
      config,
      repo: null
    });

    expect(actions).toHaveLength(0);
  });

  test('禁用 robot 时不产出 action', () => {
    const config = baseConfig();
    config.events.issue!.rules = [
      {
        id: 'rule-a',
        name: '@robot-a',
        enabled: true,
        match: {
          all: [
            { field: 'event.subType', op: 'in', values: ['commented'] },
            { field: 'comment.mentions', op: 'containsAny', values: ['@robot-a'] }
          ]
        },
        actions: [{ id: 'act-a', robotId: robotA.id, enabled: true }]
      }
    ];

    const payload = { __subType: 'commented', object_attributes: { note: 'hi @robot-a' } };
    const actions = resolveAutomationActions({
      eventType: 'issue',
      payload,
      robots: [{ ...robotA, enabled: false }],
      config,
      repo: null
    });

    expect(actions).toHaveLength(0);
  });
});
