const suppressedConsoleWarnSnippets = [
  '[test] openapi spec generation failed',
  '[test] runtime detection failed',
  '[auth] AUTH_TOKEN_SECRET is not configured'
];

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

console.warn = (...args: unknown[]) => {
  if (shouldSuppressConsoleMessage(args, suppressedConsoleWarnSnippets)) return;
  originalConsoleWarn(...args);
};
