import { api } from './client';
import type {
  SkillListResponse,
  SkillPatchInput,
  SkillPatchResponse,
  SkillSelectionKey,
  SkillSelectionResponse,
  SkillSelectionState,
  SkillSummary,
  SkillUploadResponse
} from './types';

// Fetch the skill registry for the Skills console page. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const fetchSkills = async (options?: {
  source?: 'built_in' | 'extra';
  limit?: number;
  cursor?: string;
}): Promise<SkillListResponse> => {
  // Allow paginated skill list requests for long registry views. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const { data } = await api.get<SkillListResponse>('/skills', { params: options });
  return data;
};

// Update extra skill toggles (enabled/promptEnabled) from the Skills UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const patchSkill = async (id: string, input: SkillPatchInput): Promise<SkillSummary> => {
  const { data } = await api.patch<SkillPatchResponse>(`/skills/${id}`, input);
  return data.skill;
};

// Upload a new extra skill bundle via archive file. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const uploadExtraSkill = async (file: File): Promise<SkillSummary> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<SkillUploadResponse>('/skills/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.skill;
};

// Fetch repo-level skill defaults for task-group inheritance. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const fetchRepoSkillSelection = async (repoId: string): Promise<SkillSelectionState> => {
  const { data } = await api.get<SkillSelectionResponse>(`/repos/${repoId}/skills`);
  return data.selection;
};

// Update repo-level skill defaults for new task groups. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const updateRepoSkillSelection = async (
  repoId: string,
  selection: SkillSelectionKey[] | null
): Promise<SkillSelectionState> => {
  const { data } = await api.patch<SkillSelectionResponse>(`/repos/${repoId}/skills`, { selection });
  return data.selection;
};

// Fetch task-group skill selection state (with repo-default inheritance). docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const fetchTaskGroupSkillSelection = async (taskGroupId: string): Promise<SkillSelectionState> => {
  const { data } = await api.get<SkillSelectionResponse>(`/task-groups/${taskGroupId}/skills`);
  return data.selection;
};

// Update task-group skill selection overrides. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const updateTaskGroupSkillSelection = async (
  taskGroupId: string,
  selection: SkillSelectionKey[] | null
): Promise<SkillSelectionState> => {
  const { data } = await api.patch<SkillSelectionResponse>(`/task-groups/${taskGroupId}/skills`, { selection });
  return data.selection;
};
