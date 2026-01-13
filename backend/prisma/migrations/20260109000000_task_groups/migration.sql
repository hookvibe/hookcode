-- Add task groups for grouping related tasks (issue / merge_request / commit) and binding Codex thread_id.

CREATE TABLE "task_groups" (
  "id" UUID NOT NULL,
  "repo_provider" TEXT,
  "repo_id" UUID,
  "robot_id" UUID,
  "kind" TEXT NOT NULL,
  "binding_key" TEXT NOT NULL,
  "thread_id" TEXT,
  "title" TEXT,
  "issue_id" INTEGER,
  "mr_id" INTEGER,
  "commit_sha" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "task_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_groups_binding_key_unique" ON "task_groups" ("binding_key");
CREATE INDEX "task_groups_repo_robot_updated_at_idx" ON "task_groups" ("repo_id", "robot_id", "updated_at");

ALTER TABLE "tasks"
ADD COLUMN "group_id" UUID;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_group_id_fkey"
FOREIGN KEY ("group_id") REFERENCES "task_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_group_id_created_at_idx" ON "tasks" ("group_id", "created_at");
