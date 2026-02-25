import { describe, expect, test } from 'vitest';
import { extractTaskGroupIdFromTokenName, isTaskGroupGeneratedTokenName } from '../utils/apiTokens';

describe('apiTokens utils', () => {
  // Verify task-group PAT name parsing for repo/panel filtering. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
  test('extracts task group id from auto-generated PAT names', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(extractTaskGroupIdFromTokenName(`task-group-${id}`)).toBe(id);
  });

  test('returns null for non task-group token names', () => {
    expect(extractTaskGroupIdFromTokenName('manual-token')).toBeNull();
    expect(extractTaskGroupIdFromTokenName('task-group-not-a-uuid')).toBeNull();
  });

  test('detects task-group generated token names', () => {
    expect(isTaskGroupGeneratedTokenName('task-group-123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isTaskGroupGeneratedTokenName('task-group-not-a-uuid')).toBe(false);
    expect(isTaskGroupGeneratedTokenName('custom-token')).toBe(false);
  });
});
