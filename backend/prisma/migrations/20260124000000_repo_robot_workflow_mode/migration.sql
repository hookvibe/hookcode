-- Change record:
-- - 2026-01-24: Add repo workflow mode to repo_robots so robots can explicitly choose direct/fork workflows.

ALTER TABLE "repo_robots"
ADD COLUMN "repo_workflow_mode" TEXT;
