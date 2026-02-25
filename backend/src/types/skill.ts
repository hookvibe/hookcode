// Define shared skill registry types for API and prompt injection. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225

export type SkillSource = 'built_in' | 'extra';
export type SkillSelectionKey = string; // Store skill selection keys as `${source}:${id}`. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export type SkillSelectionMode = 'custom' | 'repo_default' | 'all';

export interface SkillSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  version?: string | null;
  source: SkillSource;
  enabled: boolean;
  promptText?: string | null;
  promptEnabled: boolean;
  tags: string[]; // Store skill tags for UI filtering. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
}

export interface SkillListResponse {
  builtIn: SkillSummary[];
  extra: SkillSummary[];
}

export interface SkillPatchInput {
  enabled?: boolean;
  promptEnabled?: boolean;
  tags?: string[]; // Allow updating extra skill tags via registry. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
}

export interface SkillSelectionState {
  selection: SkillSelectionKey[] | null;
  effective: SkillSelectionKey[];
  mode: SkillSelectionMode;
}
