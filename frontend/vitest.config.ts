import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Silence Vite CJS deprecation warning during Vitest boot in CI. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
process.env.VITE_CJS_IGNORE_WARNING = '1';

export default defineConfig({
  plugins: [react()],
  // Reduce Vite/Vitest warning noise in CI output while keeping errors visible. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  logLevel: 'error',
  resolve: {
    // Ant Design X CJS entry (`lib/`) requires ESM-only antd internals, which crashes in Vitest's Node runtime.
    // Force the ESM entry (`es/`) so Vite can transform it correctly for tests.
    alias: [
      { find: /^@ant-design\/x$/, replacement: '@ant-design/x/es/index.js' },
      // `react-syntax-highlighter` CJS build `require()`s ESM-only `refractor`, which breaks under Node.
      // Force only the package root import to its ESM entry (do not rewrite deep imports like `dist/esm/styles/prism`).
      { find: /^react-syntax-highlighter$/, replacement: 'react-syntax-highlighter/dist/esm/index.js' }
    ]
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    css: true,
    restoreMocks: true,
    // Ant Design v6 + Ant Design X ship ESM entrypoints that need to be transformed by Vite in Vitest (Node) runtime.
    // Otherwise, Vitest may try to execute ESM syntax in a CJS context and crash with "Cannot use import statement outside a module".
    server: {
      deps: {
        // Inline all deps to avoid ESM/CJS mismatches in nested Ant Design packages.
        inline: true
      }
    },
    // UI tests are noticeably slower in CI (docker/shared runner); the default 5s can timeout and cause false negatives.
    testTimeout: 15000,
    hookTimeout: 15000
  }
});
