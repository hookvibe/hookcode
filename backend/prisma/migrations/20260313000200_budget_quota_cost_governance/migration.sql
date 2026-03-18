CREATE TABLE "budget_policies" (
  "id" UUID NOT NULL,
  "scope_type" TEXT NOT NULL,
  "scope_id" UUID NOT NULL,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "name" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "overage_action" TEXT NOT NULL DEFAULT 'soft_limit',
  "daily_task_count_limit" INTEGER,
  "monthly_task_count_limit" INTEGER,
  "daily_token_limit" INTEGER,
  "monthly_token_limit" INTEGER,
  "daily_estimated_cost_micro_usd" BIGINT,
  "monthly_estimated_cost_micro_usd" BIGINT,
  "max_runtime_seconds" INTEGER,
  "max_step_count" INTEGER,
  "degrade_provider" TEXT,
  "degrade_model" TEXT,
  "force_read_only_on_overage" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "budget_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budget_policies_scope_type_scope_id_unique"
  ON "budget_policies"("scope_type", "scope_id");

CREATE INDEX "budget_policies_scope_enabled_updated_at_idx"
  ON "budget_policies"("scope_type", "enabled", "updated_at");

CREATE TABLE "usage_daily_rollup" (
  "id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "bucket_date" DATE NOT NULL,
  "repo_id" UUID,
  "robot_id" UUID,
  "actor_user_id" UUID,
  "provider" TEXT,
  "model" TEXT,
  "status" TEXT NOT NULL,
  "task_count" INTEGER NOT NULL DEFAULT 1,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost_micro_usd" BIGINT NOT NULL DEFAULT 0,
  "duration_ms" INTEGER,
  "failed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_daily_rollup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_daily_rollup_task_id_key"
  ON "usage_daily_rollup"("task_id");

CREATE INDEX "usage_daily_rollup_bucket_repo_idx"
  ON "usage_daily_rollup"("bucket_date", "repo_id");

CREATE INDEX "usage_daily_rollup_bucket_robot_idx"
  ON "usage_daily_rollup"("bucket_date", "robot_id");

CREATE INDEX "usage_daily_rollup_bucket_actor_idx"
  ON "usage_daily_rollup"("bucket_date", "actor_user_id");

CREATE INDEX "usage_daily_rollup_bucket_provider_idx"
  ON "usage_daily_rollup"("bucket_date", "provider");

CREATE TABLE "usage_monthly_rollup" (
  "id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "bucket_month" DATE NOT NULL,
  "repo_id" UUID,
  "robot_id" UUID,
  "actor_user_id" UUID,
  "provider" TEXT,
  "model" TEXT,
  "status" TEXT NOT NULL,
  "task_count" INTEGER NOT NULL DEFAULT 1,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost_micro_usd" BIGINT NOT NULL DEFAULT 0,
  "duration_ms" INTEGER,
  "failed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_monthly_rollup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_monthly_rollup_task_id_key"
  ON "usage_monthly_rollup"("task_id");

CREATE INDEX "usage_monthly_rollup_bucket_repo_idx"
  ON "usage_monthly_rollup"("bucket_month", "repo_id");

CREATE INDEX "usage_monthly_rollup_bucket_robot_idx"
  ON "usage_monthly_rollup"("bucket_month", "robot_id");

CREATE INDEX "usage_monthly_rollup_bucket_actor_idx"
  ON "usage_monthly_rollup"("bucket_month", "actor_user_id");

CREATE INDEX "usage_monthly_rollup_bucket_provider_idx"
  ON "usage_monthly_rollup"("bucket_month", "provider");

CREATE TABLE "quota_events" (
  "id" UUID NOT NULL,
  "budget_policy_id" UUID,
  "task_id" UUID,
  "repo_id" UUID,
  "robot_id" UUID,
  "actor_user_id" UUID,
  "scope_type" TEXT,
  "scope_id" UUID,
  "event_type" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quota_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quota_events_created_at_idx"
  ON "quota_events"("created_at");

CREATE INDEX "quota_events_task_created_at_idx"
  ON "quota_events"("task_id", "created_at");

CREATE INDEX "quota_events_repo_created_at_idx"
  ON "quota_events"("repo_id", "created_at");

CREATE INDEX "quota_events_actor_created_at_idx"
  ON "quota_events"("actor_user_id", "created_at");

CREATE INDEX "quota_events_event_type_created_at_idx"
  ON "quota_events"("event_type", "created_at");
