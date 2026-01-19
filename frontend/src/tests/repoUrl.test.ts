import { describe, expect, test } from 'vitest';
import { parseRepoUrl } from '../utils/repoUrl';

// Validate repo URL parsing so the create-repo form can safely derive externalId/apiBaseUrl. 58w1q3n5nr58flmempxe

describe('parseRepoUrl', () => {
  test('parses GitHub web URL into externalId + apiBaseUrl', () => {
    const result = parseRepoUrl('github', 'https://github.com/openai/openai-cookbook');
    expect(result).toEqual({
      ok: true,
      value: { name: 'openai/openai-cookbook', externalId: 'openai/openai-cookbook', apiBaseUrl: 'https://api.github.com' }
    });
  });

  test('parses GitHub host/path without scheme into externalId + apiBaseUrl', () => {
    const result = parseRepoUrl('github', 'github.com/openai/openai-cookbook');
    expect(result).toEqual({
      ok: true,
      value: { name: 'openai/openai-cookbook', externalId: 'openai/openai-cookbook', apiBaseUrl: 'https://api.github.com' }
    });
  });

  test('parses GitHub SSH URL into externalId + apiBaseUrl', () => {
    const result = parseRepoUrl('github', 'git@github.com:openai/openai-cookbook.git');
    expect(result).toEqual({
      ok: true,
      value: { name: 'openai/openai-cookbook', externalId: 'openai/openai-cookbook', apiBaseUrl: 'https://api.github.com' }
    });
  });

  test('parses GitLab URL with /-/ path into namespace externalId', () => {
    const result = parseRepoUrl('gitlab', 'https://gitlab.com/group/sub/project/-/issues');
    expect(result).toEqual({
      ok: true,
      value: { name: 'group/sub/project', externalId: 'group/sub/project', apiBaseUrl: 'https://gitlab.com' }
    });
  });

  test('rejects provider mismatch when selecting GitLab but entering GitHub URL', () => {
    const result = parseRepoUrl('gitlab', 'https://github.com/openai/openai-cookbook');
    expect(result).toEqual({ ok: false, code: 'PROVIDER_MISMATCH' });
  });

  test('rejects invalid GitHub slug without owner/repo', () => {
    const result = parseRepoUrl('github', 'openai');
    expect(result).toEqual({ ok: false, code: 'MISSING_OWNER_REPO' });
  });
});
