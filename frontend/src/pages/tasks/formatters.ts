// Provide small formatting helpers for the Tasks page to keep the page component focused. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export const formatTaskTimestamp = (locale: string, iso: string): string => {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
};
