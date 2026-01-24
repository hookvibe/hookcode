import { normalizeRepoWorkflowMode, resolveRepoWorkflowMode } from '../../services/repoWorkflowMode';

// Add unit coverage for repo workflow mode normalization defaults. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124

describe('repoWorkflowMode helpers', () => {
  test('normalizeRepoWorkflowMode accepts known values', () => {
    expect(normalizeRepoWorkflowMode('auto')).toBe('auto');
    expect(normalizeRepoWorkflowMode('direct')).toBe('direct');
    expect(normalizeRepoWorkflowMode('fork')).toBe('fork');
  });

  test('normalizeRepoWorkflowMode trims and lowercases', () => {
    expect(normalizeRepoWorkflowMode(' AUTO ')).toBe('auto');
    expect(normalizeRepoWorkflowMode('Direct')).toBe('direct');
  });

  test('normalizeRepoWorkflowMode returns undefined for invalid values', () => {
    expect(normalizeRepoWorkflowMode('manual')).toBeUndefined();
    expect(normalizeRepoWorkflowMode('')).toBeUndefined();
    expect(normalizeRepoWorkflowMode(null)).toBeUndefined();
  });

  test('resolveRepoWorkflowMode defaults to auto', () => {
    expect(resolveRepoWorkflowMode(undefined)).toBe('auto');
    expect(resolveRepoWorkflowMode(null)).toBe('auto');
    expect(resolveRepoWorkflowMode('bogus')).toBe('auto');
  });
});
