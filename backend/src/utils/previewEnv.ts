// Shared helpers for preview env placeholder handling. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
// Extend preview placeholders with named ports for cross-instance links. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
const PORT_PLACEHOLDER_REGEX = /\{\{\s*PORT\s*\}\}/g;
const NAMED_PORT_PLACEHOLDER_PATTERN = '\\{\\{\\s*PORT\\s*:\\s*([a-zA-Z0-9_-]+)\\s*\\}\\}';
const NAMED_PORT_PLACEHOLDER_REGEX = new RegExp(NAMED_PORT_PLACEHOLDER_PATTERN, 'g');
const ANY_PORT_PLACEHOLDER_REGEX = /\{\{\s*PORT(?:\s*:\s*[a-zA-Z0-9_-]+)?\s*\}\}/;
const LOCAL_FIXED_PORT_REGEX = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)\s*:\s*\d{2,5}\b/i;

export const resolvePreviewEnv = (
  env: Record<string, string> | undefined,
  port: number,
  namedPorts?: Record<string, number>
): Record<string, string> => {
  if (!env) return {};
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const raw = String(value);
    const withDefaultPort = raw.replace(PORT_PLACEHOLDER_REGEX, String(port));
    resolved[key] = withDefaultPort.replace(NAMED_PORT_PLACEHOLDER_REGEX, (match, name) => {
      const resolvedPort = namedPorts?.[String(name).trim()];
      return resolvedPort === undefined ? match : String(resolvedPort);
    });
  }
  return resolved;
};

export const envKeyRequiresPortPlaceholder = (key: string): boolean => /PORT$/i.test(key);

export const envValueHasPortPlaceholder = (value: string): boolean => ANY_PORT_PLACEHOLDER_REGEX.test(value);

export const envValueHasFixedPort = (value: string): boolean =>
  LOCAL_FIXED_PORT_REGEX.test(value) && !ANY_PORT_PLACEHOLDER_REGEX.test(value);

export const extractNamedPortPlaceholders = (value: string): string[] => {
  const names: string[] = [];
  const matcher = new RegExp(NAMED_PORT_PLACEHOLDER_PATTERN, 'g');
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(value)) !== null) {
    const name = String(match[1] ?? '').trim();
    if (name) names.push(name);
  }
  return names;
};
