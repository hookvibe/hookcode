/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/tests/unit/**/*.test.ts'],
  // Load test setup to filter known warning noise in CI output. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/src/agent/build/'],
  watchPathIgnorePatterns: ['<rootDir>/src/agent/build/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }]
  }
};
