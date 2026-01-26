-- Add dependency management columns for runtime installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
ALTER TABLE "tasks" ADD COLUMN "dependency_result" JSONB;

-- Store robot-level dependency overrides for task execution. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
ALTER TABLE "repo_robots" ADD COLUMN "dependency_config_json" JSONB;
