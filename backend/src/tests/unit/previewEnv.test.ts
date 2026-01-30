import {
  envKeyRequiresPortPlaceholder,
  envValueHasFixedPort,
  envValueHasPortPlaceholder,
  resolvePreviewEnv
} from '../../utils/previewEnv';

// Validate preview env placeholder handling. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
describe('previewEnv', () => {
  test('replaces PORT placeholders in env values', () => {
    const resolved = resolvePreviewEnv(
      {
        PORT: '{{PORT}}',
        API_URL: 'http://127.0.0.1:{{PORT}}/api'
      },
      12345
    );
    expect(resolved.PORT).toBe('12345');
    expect(resolved.API_URL).toBe('http://127.0.0.1:12345/api');
  });

  test('detects fixed port env values', () => {
    expect(envValueHasFixedPort('http://localhost:5173')).toBe(true);
    expect(envValueHasFixedPort('http://localhost:{{PORT}}')).toBe(false);
  });

  test('requires PORT placeholders for port keys', () => {
    expect(envKeyRequiresPortPlaceholder('PORT')).toBe(true);
    expect(envValueHasPortPlaceholder('{{PORT}}')).toBe(true);
    expect(envValueHasPortPlaceholder('5173')).toBe(false);
  });
});
