import {
  RepoAutomationConfigValidationError,
  validateAutomationConfigOrThrow
} from '../../modules/repositories/repo-automation.service';
import type { RepoAutomationConfig } from '../../types/automation';

describe('repoAutomation config 校验', () => {
  test('rule.name 为空时抛出校验错误（RULE_NAME_REQUIRED）', () => {
    const config: RepoAutomationConfig = {
      version: 2,
      events: {
        issue: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: '   ',
              enabled: true,
              actions: [{ id: 'act-1', robotId: 'rb-1', enabled: true }]
            }
          ]
        }
      }
    };

    try {
      validateAutomationConfigOrThrow(config);
      throw new Error('expected validateAutomationConfigOrThrow to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(RepoAutomationConfigValidationError);
      expect(err.code).toBe('RULE_NAME_REQUIRED');
    }
  });

  test('rule.actions 为空时抛出校验错误', () => {
    const config: RepoAutomationConfig = {
      version: 2,
      events: {
        issue: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'rule 1',
              enabled: true,
              actions: []
            }
          ]
        }
      }
    };

    expect(() => validateAutomationConfigOrThrow(config)).toThrow(RepoAutomationConfigValidationError);
  });

  test('rule.actions 非空时通过', () => {
    const config: RepoAutomationConfig = {
      version: 2,
      events: {
        issue: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'rule 1',
              enabled: true,
              actions: [{ id: 'act-1', robotId: 'rb-1', enabled: true }]
            }
          ]
        }
      }
    };

    expect(() => validateAutomationConfigOrThrow(config)).not.toThrow();
  });

  // Validate timeWindow validation errors for automation rules. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  test('throws RULE_TIME_WINDOW_INVALID when rule.timeWindow is invalid', () => {
    const config: RepoAutomationConfig = {
      version: 2,
      events: {
        issue: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'rule 1',
              enabled: true,
              timeWindow: { startHour: -1, endHour: 2 } as any,
              actions: [{ id: 'act-1', robotId: 'rb-1', enabled: true }]
            }
          ]
        }
      }
    };

    try {
      validateAutomationConfigOrThrow(config);
      throw new Error('expected validateAutomationConfigOrThrow to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(RepoAutomationConfigValidationError);
      expect(err.code).toBe('RULE_TIME_WINDOW_INVALID');
    }
  });

  // Ensure valid timeWindow values pass validation. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  test('accepts valid rule.timeWindow values', () => {
    const config: RepoAutomationConfig = {
      version: 2,
      events: {
        issue: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'rule 1',
              enabled: true,
              timeWindow: { startHour: 2, endHour: 4 },
              actions: [{ id: 'act-1', robotId: 'rb-1', enabled: true }]
            }
          ]
        }
      }
    };

    expect(() => validateAutomationConfigOrThrow(config)).not.toThrow();
  });
});
