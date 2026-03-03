-- Add system/audit logs table for admin observability. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

CREATE TABLE "system_logs" (
    "id" uuid NOT NULL,
    "category" text NOT NULL,
    "level" text NOT NULL,
    "message" text NOT NULL,
    "code" text,
    "actor_user_id" uuid,
    "repo_id" uuid,
    "task_id" uuid,
    "task_group_id" uuid,
    "meta_json" jsonb,
    "created_at" timestamptz(6) NOT NULL DEFAULT now(),

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");
CREATE INDEX "system_logs_category_created_at_idx" ON "system_logs"("category", "created_at");
CREATE INDEX "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at");
CREATE INDEX "system_logs_actor_created_at_idx" ON "system_logs"("actor_user_id", "created_at");
CREATE INDEX "system_logs_repo_created_at_idx" ON "system_logs"("repo_id", "created_at");
CREATE INDEX "system_logs_task_created_at_idx" ON "system_logs"("task_id", "created_at");
CREATE INDEX "system_logs_task_group_created_at_idx" ON "system_logs"("task_group_id", "created_at");
