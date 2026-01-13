export const isTruthy = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) return defaultValue;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'n' || raw === 'off') return false;
  return defaultValue;
};

