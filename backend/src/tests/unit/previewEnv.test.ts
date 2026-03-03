import {
  envKeyRequiresPortPlaceholder,
  envValueHasFixedPort,
  envValueHasPortPlaceholder,
  resolvePreviewEnv
} from '../../utils/previewEnv';

// Validate preview env placeholder handling. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
describe('previewEnv', () => {
  test('replaces PORT placeholders in env values', () => {
    const resolved = resolvePreviewEnv(
      {
        PORT: '{{PORT}}',
        API_URL: 'http://127.0.0.1:{{PORT}}/api',
        BACKEND_URL: 'http://127.0.0.1:{{PORT:backend}}/api'
      },
      12345,
      { backend: 23456 }
    );
    expect(resolved.PORT).toBe('12345');
    expect(resolved.API_URL).toBe('http://127.0.0.1:12345/api');
    expect(resolved.BACKEND_URL).toBe('http://127.0.0.1:23456/api');
  });

  test('detects fixed local ports in env values', () => {
    expect(envValueHasFixedPort('http://localhost:5173')).toBe(true);
    expect(envValueHasFixedPort('http://localhost:{{PORT}}')).toBe(false);
    expect(envValueHasFixedPort('postgresql://db.example.com:7214/app')).toBe(false);
  });

  test('requires PORT placeholders for port keys', () => {
    expect(envKeyRequiresPortPlaceholder('PORT')).toBe(true);
    expect(envValueHasPortPlaceholder('{{PORT}}')).toBe(true);
    expect(envValueHasPortPlaceholder('{{PORT:frontend}}')).toBe(true);
    expect(envValueHasPortPlaceholder('5173')).toBe(false);
  });
});
