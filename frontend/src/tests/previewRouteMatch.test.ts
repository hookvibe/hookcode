import { describe, expect, test } from 'vitest';
import { matchPreviewTargetUrl, splitPreviewTargetUrlCandidates } from '../utils/previewRouteMatch';

describe('preview route matcher', () => {
  test('splits multiple targetUrl patterns with ||', () => {
    // Support OR matching for targetUrl patterns. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    expect(splitPreviewTargetUrlCandidates('/add||/create||/edit')).toEqual(['/add', '/create', '/edit']);
  });

  test('matches dynamic path params and ignores token query', () => {
    // Allow :param segments and drop auth tokens when matching preview routes. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const currentUrl = 'http://127.0.0.1:10000/users/123?token=abc';
    expect(matchPreviewTargetUrl(currentUrl, '/users/:id')).toBe(true);
  });

  test('matches wildcard path segments and query value patterns', () => {
    // Accept * and ** wildcards plus query value matchers in targetUrl rules. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const currentUrl = 'http://127.0.0.1:10000/projects/team-a/settings?tab=activity&sort=desc';
    expect(matchPreviewTargetUrl(currentUrl, '/projects/**/settings?tab=*')).toBe(true);
  });

  test('matches hash fragments with wildcards', () => {
    // Match hash patterns when targetUrl declares them. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const currentUrl = 'http://127.0.0.1:10000/docs#section-2';
    expect(matchPreviewTargetUrl(currentUrl, '/docs#section-*')).toBe(true);
  });

  test('matches any listed targetUrl candidate', () => {
    // Treat || as an OR condition for route matching. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const currentUrl = 'http://127.0.0.1:10000/create';
    expect(matchPreviewTargetUrl(currentUrl, '/add||/create')).toBe(true);
  });

  test('fails when origin differs for absolute targetUrl patterns', () => {
    // Require origin matches when targetUrl includes an explicit scheme/host. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const currentUrl = 'http://127.0.0.1:10000/add';
    expect(matchPreviewTargetUrl(currentUrl, 'http://example.com/add')).toBe(false);
  });
});
