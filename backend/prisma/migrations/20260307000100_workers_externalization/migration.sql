-- Introduce external worker registry and worker attribution fields for task dispatch. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
CREATE TABLE IF NOT EXISTS "workers" (
  "id" UUID PRIMARY KEY,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "system_managed" BOOLEAN NOT NULL DEFAULT FALSE,
  "version" TEXT,
  "platform" TEXT,
  "arch" TEXT,
  "hostname" TEXT,
  "backend_base_url" TEXT,
  "capabilities_json" JSONB,
  "runtime_state_json" JSONB,
  "max_concurrency" INTEGER NOT NULL DEFAULT 1,
  "current_concurrency" INTEGER NOT NULL DEFAULT 0,
  "token_hash" TEXT,
  "last_seen_at" TIMESTAMPTZ(6),
  "last_hello_at" TIMESTAMPTZ(6),
  "disabled_at" TIMESTAMPTZ(6),
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "worker_id" UUID;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "worker_lost_at" TIMESTAMPTZ(6);
ALTER TABLE "task_groups" ADD COLUMN IF NOT EXISTS "worker_id" UUID;
ALTER TABLE "repo_robots" ADD COLUMN IF NOT EXISTS "default_worker_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_worker_id_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_worker_id_fkey"
      FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'task_groups_worker_id_fkey'
  ) THEN
    ALTER TABLE "task_groups"
      ADD CONSTRAINT "task_groups_worker_id_fkey"
      FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'repo_robots_default_worker_id_fkey'
  ) THEN
    ALTER TABLE "repo_robots"
      ADD CONSTRAINT "repo_robots_default_worker_id_fkey"
      FOREIGN KEY ("default_worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "workers_status_updated_at_idx" ON "workers"("status", "updated_at");
CREATE INDEX IF NOT EXISTS "workers_kind_updated_at_idx" ON "workers"("kind", "updated_at");
CREATE INDEX IF NOT EXISTS "workers_last_seen_at_idx" ON "workers"("last_seen_at");
CREATE INDEX IF NOT EXISTS "tasks_worker_status_created_at_idx" ON "tasks"("worker_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "task_groups_worker_updated_at_idx" ON "task_groups"("worker_id", "updated_at");
CREATE INDEX IF NOT EXISTS "repo_robots_default_worker_id_idx" ON "repo_robots"("default_worker_id");
