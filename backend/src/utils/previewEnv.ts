// Shared helpers for preview env placeholder handling. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
const PORT_PLACEHOLDER_REGEX = /\{\{\s*PORT\s*\}\}/g;
const PORT_PLACEHOLDER_TEST = /\{\{\s*PORT\s*\}\}/;
const FIXED_PORT_REGEX = /:\s*\d{2,5}\b/;

export const resolvePreviewEnv = (env: Record<string, string> | undefined, port: number): Record<string, string> => {
  if (!env) return {};
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    resolved[key] = String(value).replace(PORT_PLACEHOLDER_REGEX, String(port));
  }
  return resolved;
};

export const envKeyRequiresPortPlaceholder = (key: string): boolean => /PORT$/i.test(key);

export const envValueHasPortPlaceholder = (value: string): boolean => PORT_PLACEHOLDER_TEST.test(value);

export const envValueHasFixedPort = (value: string): boolean =>
  FIXED_PORT_REGEX.test(value) && !PORT_PLACEHOLDER_TEST.test(value);
