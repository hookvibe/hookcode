-- Add preview env storage for repo-scoped preview vars. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
ALTER TABLE "repositories" ADD COLUMN "preview_env_json" JSONB;
