-- Add explicit per-group ordering for queued task workspace sequencing. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "group_order" INTEGER;

-- Backfill group order from existing task creation time so older task groups keep a stable sequence. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY created_at ASC, id ASC) AS seq
  FROM tasks
  WHERE group_id IS NOT NULL
)
UPDATE tasks AS t
SET group_order = ranked.seq
FROM ranked
WHERE t.id = ranked.id
  AND t.group_order IS NULL;

CREATE INDEX IF NOT EXISTS "tasks_group_id_group_order_idx"
  ON "tasks" ("group_id", "group_order");
