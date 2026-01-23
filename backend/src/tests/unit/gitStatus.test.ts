import { buildWorkingTree, computeGitPushState, computeGitStatusDelta, parseAheadBehind } from '../../utils/gitStatus';

// Add unit coverage for git status parsing + push state logic. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj

describe('gitStatus utils', () => {
  describe('parseAheadBehind', () => {
    test('parses numeric counts', () => {
      expect(parseAheadBehind('2\t5')).toEqual({ ahead: 2, behind: 5 });
    });

    test('returns null for invalid input', () => {
      expect(parseAheadBehind('')).toBeNull();
      expect(parseAheadBehind('oops')).toBeNull();
    });
  });

  describe('buildWorkingTree', () => {
    test('splits staged/unstaged/untracked lists', () => {
      const workingTree = buildWorkingTree({
        stagedRaw: 'a.ts\nb.ts\n',
        unstagedRaw: 'c.ts',
        untrackedRaw: 'd.ts\n'
      });
      expect(workingTree).toEqual({
        staged: ['a.ts', 'b.ts'],
        unstaged: ['c.ts'],
        untracked: ['d.ts']
      });
    });
  });

  describe('computeGitStatusDelta', () => {
    test('detects branch + head changes', () => {
      const delta = computeGitStatusDelta(
        { branch: 'main', headSha: 'a' },
        { branch: 'feature', headSha: 'b' }
      );
      expect(delta).toEqual({ branchChanged: true, headChanged: true });
    });
  });

  describe('computeGitPushState', () => {
    test('returns not_applicable when no commit change', () => {
      const state = computeGitPushState({
        delta: { branchChanged: false, headChanged: false },
        final: { branch: 'main', headSha: 'a' }
      });
      expect(state.status).toBe('not_applicable');
    });

    test('returns pushed when target matches head', () => {
      const state = computeGitPushState({
        delta: { branchChanged: false, headChanged: true },
        final: { branch: 'main', headSha: 'abc' },
        pushTargetSha: 'abc'
      });
      expect(state.status).toBe('pushed');
    });

    test('returns unpushed when target differs', () => {
      const state = computeGitPushState({
        delta: { branchChanged: false, headChanged: true },
        final: { branch: 'main', headSha: 'abc' },
        pushTargetSha: 'def'
      });
      expect(state.status).toBe('unpushed');
    });

    // Ensure missing ls-remote output maps to "unpushed" instead of error. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    test('returns unpushed when target is missing', () => {
      const state = computeGitPushState({
        delta: { branchChanged: false, headChanged: true },
        final: { branch: 'main', headSha: 'abc' }
      });
      expect(state.status).toBe('unpushed');
    });

    test('returns error when explicitly provided', () => {
      const state = computeGitPushState({
        delta: { branchChanged: false, headChanged: true },
        final: { branch: 'main', headSha: 'abc' },
        error: 'pushTarget: failed'
      });
      expect(state.status).toBe('error');
    });
  });
});
