-- Add notifications table and task actor reference for user alerts. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302

ALTER TABLE "tasks"
  ADD COLUMN "actor_user_id" UUID;

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "code" TEXT,
  "repo_id" UUID,
  "task_id" UUID,
  "task_group_id" UUID,
  "meta_json" JSONB,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_created_at_idx" ON "notifications" ("user_id", "created_at");
CREATE INDEX "notifications_user_read_at_idx" ON "notifications" ("user_id", "read_at");
CREATE INDEX "notifications_repo_created_at_idx" ON "notifications" ("repo_id", "created_at");
CREATE INDEX "notifications_task_created_at_idx" ON "notifications" ("task_id", "created_at");
