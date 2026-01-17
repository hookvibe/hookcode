import { canTokenPushToUpstream, normalizeGitRemoteUrl } from '../../utils/gitWorkflow';

// Add unit coverage for git workflow helpers used by fork-based PR setup. 24yz61mdik7tqdgaa152

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
});

