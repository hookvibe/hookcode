import { buildPreviewPublicUrl, resolvePreviewHostMatch } from '../../utils/previewHost';

// Validate preview host routing helpers for subdomain mode. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
describe('previewHost', () => {
  const originalEnv = { ...process.env };

  const resetEnv = () => {
    process.env = { ...originalEnv };
  };

  beforeEach(() => {
    resetEnv();
  });

  afterAll(() => {
    resetEnv();
  });

  test('builds public preview URLs for subdomain mode', () => {
    process.env.HOOKCODE_PREVIEW_HOST_MODE = 'subdomain';
    process.env.HOOKCODE_PREVIEW_BASE_DOMAIN = 'preview.example.com';
    process.env.HOOKCODE_PREVIEW_PUBLIC_SCHEME = 'https';

    expect(buildPreviewPublicUrl('group-1', 'app')).toBe('https://group-1--app.preview.example.com/');
  });

  test('parses task group + instance from preview subdomain hosts', () => {
    process.env.HOOKCODE_PREVIEW_HOST_MODE = 'subdomain';
    process.env.HOOKCODE_PREVIEW_BASE_DOMAIN = 'preview.example.com';

    const match = resolvePreviewHostMatch('group-1--frontend.preview.example.com');
    expect(match).toEqual({ taskGroupId: 'group-1', instanceName: 'frontend' });
  });

  test('ignores host routing when subdomain mode is disabled', () => {
    process.env.HOOKCODE_PREVIEW_HOST_MODE = 'path';
    process.env.HOOKCODE_PREVIEW_BASE_DOMAIN = 'preview.example.com';

    expect(resolvePreviewHostMatch('group-1--frontend.preview.example.com')).toBeNull();
  });
});
