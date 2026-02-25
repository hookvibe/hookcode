-- Migrate skill selection arrays to JSONB to allow null for inheritance semantics. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
ALTER TABLE "task_groups"
  ALTER COLUMN "skill_selections" TYPE JSONB
  USING CASE
    WHEN "skill_selections" IS NULL THEN NULL
    ELSE to_jsonb("skill_selections")
  END;

-- Migrate repo default skill arrays to JSONB to allow null for "all skills" semantics. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
ALTER TABLE "repositories"
  ALTER COLUMN "skill_defaults" TYPE JSONB
  USING CASE
    WHEN "skill_defaults" IS NULL THEN NULL
    ELSE to_jsonb("skill_defaults")
  END;
