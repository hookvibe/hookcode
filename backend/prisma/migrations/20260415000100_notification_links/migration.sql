-- Persist notification target links for in-app hash navigation or preserved external URLs. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
ALTER TABLE "notifications"
ADD COLUMN "link_url" TEXT;

-- Backfill task-detail hashes for existing task notifications so old alerts stay navigable. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
UPDATE "notifications"
SET "link_url" = '#/tasks/' || "task_id"::text
WHERE "link_url" IS NULL
  AND "task_id" IS NOT NULL;
