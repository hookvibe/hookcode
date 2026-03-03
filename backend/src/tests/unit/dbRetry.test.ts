import {
  getSchemaRetryAttempts,
  getSchemaRetryBaseDelayMs,
  getSchemaRetryDelayMs,
  isTransientDbBootstrapError
} from '../../utils/dbRetry';

// Validate transient DB bootstrap retry guards used by preview startup schema initialization. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
describe('dbRetry utils', () => {
  test('identifies transient bootstrap errors by code', () => {
    expect(isTransientDbBootstrapError({ code: 'ECONNRESET' })).toBe(true);
    expect(isTransientDbBootstrapError({ code: '57P01' })).toBe(true);
    expect(isTransientDbBootstrapError({ code: 'P2025' })).toBe(false);
  });

  test('identifies transient bootstrap errors by nested cause', () => {
    expect(
      isTransientDbBootstrapError({
        message: 'top level',
        cause: { message: 'read ECONNRESET', code: 'ECONNRESET' }
      })
    ).toBe(true);
  });

  test('normalizes retry settings from env', () => {
    const originalAttempts = process.env.HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS;
    const originalDelay = process.env.HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS;
    try {
      process.env.HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS = '0';
      process.env.HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS = '20';
      expect(getSchemaRetryAttempts()).toBe(1);
      expect(getSchemaRetryBaseDelayMs()).toBe(100);

      process.env.HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS = '12';
      process.env.HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS = '20000';
      expect(getSchemaRetryAttempts()).toBe(10);
      expect(getSchemaRetryBaseDelayMs()).toBe(10000);
    } finally {
      if (originalAttempts === undefined) delete process.env.HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS;
      else process.env.HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS = originalAttempts;
      if (originalDelay === undefined) delete process.env.HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS;
      else process.env.HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS = originalDelay;
    }
  });

  test('computes bounded retry delay', () => {
    expect(getSchemaRetryDelayMs(1, 1000)).toBe(1000);
    expect(getSchemaRetryDelayMs(2, 1000)).toBe(2000);
    expect(getSchemaRetryDelayMs(100, 1000)).toBe(15000);
  });
});
