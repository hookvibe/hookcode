const suppressedConsoleWarnSnippets = [
  '[test] openapi spec generation failed',
  '[test] runtime detection failed',
  '[auth] AUTH_TOKEN_SECRET is not configured',
  // Suppress preview WS proxy attach warning from test bootstrap. docs/en/developer/plans/test-output-noise-20260129/task_plan.md test-output-noise-20260129
  '[test] preview WS proxy attach failed'
];

// Suppress expected error logs emitted by negative-path tests. docs/en/developer/plans/test-output-noise-20260129/task_plan.md test-output-noise-20260129
const suppressedConsoleErrorSnippets = ['[auth] AuthGuard user load failed'];

const buildConsoleMessage = (args: unknown[]) =>
  args
    .map((arg) => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

const shouldSuppressConsoleMessage = (args: unknown[], snippets: string[]) => {
  const message = buildConsoleMessage(args);
  return snippets.some((snippet) => message.includes(snippet));
};

// Filter known test-only warnings so backend CI output stays focused on failures. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

console.warn = (...args: unknown[]) => {
  if (shouldSuppressConsoleMessage(args, suppressedConsoleWarnSnippets)) return;
  originalConsoleWarn(...args);
};

// Filter expected auth guard errors to keep test output readable. docs/en/developer/plans/test-output-noise-20260129/task_plan.md test-output-noise-20260129
console.error = (...args: unknown[]) => {
  if (shouldSuppressConsoleMessage(args, suppressedConsoleErrorSnippets)) return;
  originalConsoleError(...args);
};
