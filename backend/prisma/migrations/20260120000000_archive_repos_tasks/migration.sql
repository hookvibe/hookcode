-- Change record:
-- - 2026-01-20: Add `archived_at` fields for repositories/tasks/task_groups to support the Archive area in the console. qnp1mtxhzikhbi0xspbc

ALTER TABLE "repositories"
ADD COLUMN "archived_at" TIMESTAMPTZ;

CREATE INDEX "repositories_archived_at_idx" ON "repositories" ("archived_at");

ALTER TABLE "tasks"
ADD COLUMN "archived_at" TIMESTAMPTZ;

CREATE INDEX "tasks_archived_at_idx" ON "tasks" ("archived_at");

ALTER TABLE "task_groups"
ADD COLUMN "archived_at" TIMESTAMPTZ;

CREATE INDEX "task_groups_archived_at_idx" ON "task_groups" ("archived_at");

