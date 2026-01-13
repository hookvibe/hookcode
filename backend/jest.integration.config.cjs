/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/tests/integration/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/src/agent/build/'],
  watchPathIgnorePatterns: ['<rootDir>/src/agent/build/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }]
  }
};
