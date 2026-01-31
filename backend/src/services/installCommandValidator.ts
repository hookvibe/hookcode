import type { RuntimeRequirement } from '../types/dependency';

export const BLOCKED_CHARS = /[;&|`$(){}]/;

// Maintain allowlisted install command patterns for dependency execution. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
const ALLOWED_PATTERNS: Record<RuntimeRequirement['language'], RegExp[]> = {
  node: [
    /^npm ci(\s+--[\w-]+)*$/,
    /^npm install(\s+--[\w-]+)*$/,
    /^yarn install(\s+--[\w-]+)*$/,
    /^pnpm install(\s+--[\w-]+)*$/
  ],
  python: [
    /^pip install -r requirements\.txt(\s+--[\w-]+)*$/,
    /^pip install -e \.(\s+--[\w-]+)*$/,
    /^poetry install(\s+--[\w-]+)*$/
  ],
  java: [
    /^mvn dependency:resolve(\s+-[\w]+)*$/,
    /^gradle dependencies(\s+--[\w-]+)*$/
  ],
  ruby: [
    /^bundle install(\s+--[\w-]+)*$/,
    /^gem install bundler$/
  ],
  go: [
    /^go mod download(\s+--[\w-]+)*$/,
    /^go mod tidy(\s+--[\w-]+)*$/
  ]
};

export type InstallCommandValidation = {
  valid: boolean;
  reason?: string;
  reasonCode?: 'blocked_chars' | 'not_allowed';
};

export const validateInstallCommand = (
  language: RuntimeRequirement['language'],
  command: string,
  options?: { allowCustomInstall?: boolean }
): InstallCommandValidation => {
  // Validate dependency install commands against allowlists and safe characters. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const trimmed = String(command ?? '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'install command is empty', reasonCode: 'not_allowed' };
  }

  if (BLOCKED_CHARS.test(trimmed)) {
    return { valid: false, reason: 'install command contains blocked characters', reasonCode: 'blocked_chars' };
  }

  const patterns = ALLOWED_PATTERNS[language] ?? [];
  const matched = patterns.some((pattern) => pattern.test(trimmed));
  if (matched) {
    return { valid: true };
  }

  if (options?.allowCustomInstall) {
    return { valid: true };
  }

  return { valid: false, reason: 'install command is not in allowlist', reasonCode: 'not_allowed' };
};
