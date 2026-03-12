-- Remove the retired worker ownership flag so worker rows only store runtime and routing state. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
ALTER TABLE "workers" DROP COLUMN IF EXISTS "system_managed";
