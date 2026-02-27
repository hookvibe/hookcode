-- Enforce single processing task per task group across workers. docs/en/developer/plans/taskgroup-parallel-20260227/task_plan.md taskgroup-parallel-20260227
CREATE UNIQUE INDEX "tasks_group_processing_unique_idx"
  ON "tasks" ("group_id")
  WHERE status = 'processing'
    AND archived_at IS NULL
    AND group_id IS NOT NULL;
