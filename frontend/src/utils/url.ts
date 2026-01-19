// URL helpers shared across pages/components (UI-only; never treat as a security boundary). 58w1q3n5nr58flmempxe

export const isLocalhostUrl = (raw: string): boolean => {
  try {
    const url = new URL(String(raw ?? '').trim());
    const hostnameRaw = url.hostname;
    const host = hostnameRaw.startsWith('[') && hostnameRaw.endsWith(']') ? hostnameRaw.slice(1, -1) : hostnameRaw;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
  } catch {
    return false;
  }
};
