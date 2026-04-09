-- Add one explicit global-default worker flag so production routing no longer depends on system-worker bootstrap rows.
ALTER TABLE "workers"
ADD COLUMN "is_global_default" BOOLEAN NOT NULL DEFAULT FALSE;

-- Enforce at most one global default worker at a time.
CREATE UNIQUE INDEX "workers_is_global_default_true_unique"
ON "workers" ("is_global_default")
WHERE "is_global_default" = TRUE;
