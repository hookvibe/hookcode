import { canTokenPushToUpstream, GIT_CONFIG_KEYS, normalizeGitRemoteUrl, toRepoWebUrl } from '../../utils/gitWorkflow';

// Add unit coverage for git workflow helpers and config keys used by fork-based PR setup. docs/en/developer/plans/gitcfgfix20260123/task_plan.md gitcfgfix20260123

describe('gitWorkflow utils', () => {
  describe('normalizeGitRemoteUrl', () => {
    test('strips basic auth and .git suffix', () => {
      expect(normalizeGitRemoteUrl('https://x-access-token:secret@github.com/foo/bar.git')).toBe('https://github.com/foo/bar');
    });

    test('strips trailing slashes', () => {
      expect(normalizeGitRemoteUrl('https://github.com/foo/bar///')).toBe('https://github.com/foo/bar');
    });

    test('handles empty input', () => {
      expect(normalizeGitRemoteUrl('')).toBe('');
    });
  });

  describe('canTokenPushToUpstream', () => {
    test('github roles', () => {
      expect(canTokenPushToUpstream('github', 'admin')).toBe(true);
      expect(canTokenPushToUpstream('github', 'maintain')).toBe(true);
      expect(canTokenPushToUpstream('github', 'write')).toBe(true);
      expect(canTokenPushToUpstream('github', 'read')).toBe(false);
      expect(canTokenPushToUpstream('github', 'triage')).toBe(false);
    });

    test('gitlab roles', () => {
      expect(canTokenPushToUpstream('gitlab', 'owner')).toBe(true);
      expect(canTokenPushToUpstream('gitlab', 'maintainer')).toBe(true);
      expect(canTokenPushToUpstream('gitlab', 'developer')).toBe(true);
      expect(canTokenPushToUpstream('gitlab', 'reporter')).toBe(false);
      expect(canTokenPushToUpstream('gitlab', 'guest')).toBe(false);
    });
  });

  describe('toRepoWebUrl', () => {
    // Validate web URL derivation for git status links in the UI. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    test('preserves normalized https URLs', () => {
      expect(toRepoWebUrl('https://x-access-token:secret@github.com/foo/bar.git')).toBe('https://github.com/foo/bar');
    });

    test('converts scp-style ssh remotes', () => {
      expect(toRepoWebUrl('git@github.com:foo/bar.git')).toBe('https://github.com/foo/bar');
    });

    test('converts ssh:// remotes', () => {
      expect(toRepoWebUrl('ssh://git@gitlab.com/foo/bar.git')).toBe('https://gitlab.com/foo/bar');
    });
  });

  describe('GIT_CONFIG_KEYS', () => {
    // Verify git config key names remain valid for agent hook setup. docs/en/developer/plans/gitcfgfix20260123/task_plan.md gitcfgfix20260123
    test('uses git-config-compliant key names', () => {
      expect(GIT_CONFIG_KEYS.upstream).toBe('hookcode.upstream-url');
      expect(GIT_CONFIG_KEYS.push).toBe('hookcode.push-url');
      expect(GIT_CONFIG_KEYS.upstream.includes('_')).toBe(false);
      expect(GIT_CONFIG_KEYS.push.includes('_')).toBe(false);
    });
  });
});
