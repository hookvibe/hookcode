import type { SkillSelectionKey, SkillSummary } from '../api';

// Build consistent selection keys for skills across repo/task-group settings. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const buildSkillSelectionKey = (skill: SkillSummary): SkillSelectionKey => `${skill.source}:${skill.id}`;

// Compare selection keys in a case-sensitive, stable way. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const isSkillSelected = (selection: SkillSelectionKey[], skill: SkillSummary): boolean =>
  selection.includes(buildSkillSelectionKey(skill));

// Filter skills by search query and tag selections for selection panels. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export const filterSkillsByQueryAndTags = (skills: SkillSummary[], query: string, activeTags: string[]): SkillSummary[] => {
  const q = query.trim().toLowerCase();
  const tagNeedles = activeTags.map((tag) => tag.toLowerCase());
  if (!q && !tagNeedles.length) return skills;
  return skills.filter((skill) => {
    const haystack = `${skill.name} ${skill.slug} ${skill.description ?? ''} ${(skill.tags ?? []).join(' ')}`.toLowerCase();
    const matchesQuery = !q || haystack.includes(q);
    const matchesTags =
      !tagNeedles.length ||
      (skill.tags ?? []).some((tag) => tagNeedles.includes(tag.toLowerCase()));
    return matchesQuery && matchesTags;
  });
};
