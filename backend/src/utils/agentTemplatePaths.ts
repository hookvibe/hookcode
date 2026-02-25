import { existsSync } from 'fs';
import path from 'path';

export const resolveAgentExampleTemplateDir = (templateName: string): string | null => {
  // Resolve agent example templates so CLI config files can be shared across services. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'backend', 'src', 'agent', 'example', templateName),
    path.join(cwd, 'src', 'agent', 'example', templateName),
    path.join(__dirname, '..', 'agent', 'example', templateName)
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

export const resolveAgentExampleSkillsRoot = (): string | null => {
  // Normalize the built-in skill root for registry scanning. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const template = resolveAgentExampleTemplateDir('.codex');
  return template ? path.join(template, 'skills') : null;
};
