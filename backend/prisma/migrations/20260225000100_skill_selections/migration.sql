-- Add repo/task-group skill selection storage for the skills registry. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
ALTER TABLE "task_groups" ADD COLUMN "skill_selections" TEXT[];
ALTER TABLE "repositories" ADD COLUMN "skill_defaults" TEXT[];
