// Define skill registry API shapes for the console UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225

export type SkillSource = 'built_in' | 'extra';
export type SkillSelectionKey = string; // Use `${source}:${id}` keys for skill selections. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
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
  tags: string[]; // Provide tag metadata for filtering in the Skills UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
}

export interface SkillListResponse {
  builtIn: SkillSummary[];
  extra: SkillSummary[];
}

export interface SkillPatchInput {
  enabled?: boolean;
  promptEnabled?: boolean;
  tags?: string[]; // Allow tag updates for extra skills. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
}

export interface SkillPatchResponse {
  skill: SkillSummary;
}

export interface SkillUploadResponse {
  skill: SkillSummary;
}

export interface SkillSelectionState {
  selection: SkillSelectionKey[] | null;
  effective: SkillSelectionKey[];
  mode: SkillSelectionMode;
}

export interface SkillSelectionResponse {
  selection: SkillSelectionState;
}
