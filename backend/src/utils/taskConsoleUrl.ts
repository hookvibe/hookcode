// Build HookCode task detail URLs for provider comments and error reports. docs/en/developer/plans/taskdetailbacklink20260122k4p8/task_plan.md taskdetailbacklink20260122k4p8

export const getTaskConsoleUrl = (taskId: string): string => {
  const prefixFromEnv = String(process.env.HOOKCODE_CONSOLE_TASK_URL_PREFIX ?? '').trim();
  const baseFromEnv = String(process.env.HOOKCODE_CONSOLE_BASE_URL ?? '').trim();
  const defaultPrefix = (() => {
    const base = baseFromEnv.replace(/\/+$/, '');
    if (base) return `${base}/#/tasks/`;
    return 'http://localhost:5173/#/tasks/';
  })();

  const prefix = prefixFromEnv || defaultPrefix;
  if (prefix.endsWith('/')) return `${prefix}${taskId}`;
  return `${prefix}/${taskId}`;
};

