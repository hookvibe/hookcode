// Centralize UTC day helpers shared across repo dashboard activity components. dashtrendline20260119m9v2

export const dayKeyUtc = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

export const utcTodayDay = (): string => dayKeyUtc(new Date().toISOString());

export const addDaysUtc = (day: string, delta: number): string => {
  try {
    const d = new Date(`${day}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  } catch {
    return day;
  }
};

export const formatDayLabel = (locale: string, day: string): string => {
  try {
    const d = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return day;
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
  } catch {
    return day;
  }
};

export const formatDateTime = (locale: string, iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch {
    return iso;
  }
};

export const enumerateDaysUtcInclusive = (startDay: string, endDay: string): string[] => {
  const start = new Date(`${startDay}T00:00:00.000Z`);
  const end = new Date(`${endDay}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) return [];

  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (out.length > 5000) break;
  }
  return out;
};
