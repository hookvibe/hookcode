-- The project is still in active development and backward compatibility for old DB data is not required.
-- This migration defines the current best schema for a clean init.

CREATE TABLE "tasks" (
  "id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payload_json" JSONB,
  "prompt_custom" TEXT,
  "title" TEXT,
  "project_id" INTEGER,
  "repo_provider" TEXT,
  "repo_id" UUID,
  "robot_id" UUID,
  "ref" TEXT,
  "mr_id" INTEGER,
  "issue_id" INTEGER,
  "retries" INTEGER NOT NULL DEFAULT 0,
  "result_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_status_created_at_idx" ON "tasks" ("status", "created_at");

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "username" TEXT NOT NULL,
  "username_lower" TEXT NOT NULL,
  "display_name" TEXT,
  "model_credentials_json" JSONB,
  "password_hash" TEXT NOT NULL,
  "password_salt" TEXT NOT NULL,
  "disabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_lower_unique" ON "users" ("username_lower");

CREATE TABLE "repositories" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "external_id" TEXT,
  "api_base_url" TEXT,
  "branches_json" JSONB,
  "webhook_secret" TEXT,
  "repo_provider_credentials_json" JSONB,
  "model_provider_credentials_json" JSONB,
  "webhook_verified_at" TIMESTAMPTZ,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repositories_provider_external_unique"
ON "repositories" ("provider", "external_id");

CREATE TABLE "repo_webhook_deliveries" (
  "id" UUID NOT NULL,
  "repo_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "event_name" TEXT,
  "delivery_id" TEXT,
  "result" TEXT NOT NULL,
  "http_status" INTEGER NOT NULL,
  "code" TEXT,
  "message" TEXT,
  "task_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "payload_json" JSONB,
  "response_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "repo_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "repo_webhook_deliveries"
ADD CONSTRAINT "repo_webhook_deliveries_repo_id_fkey"
FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "repo_webhook_deliveries_repo_id_created_at_idx"
ON "repo_webhook_deliveries" ("repo_id", "created_at");

CREATE TABLE "repo_robots" (
  "id" UUID NOT NULL,
  "repo_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "token" TEXT,
  "clone_username" TEXT,
  "repo_credential_profile_id" TEXT,
  "repo_token_user_id" TEXT,
  "repo_token_username" TEXT,
  "repo_token_user_name" TEXT,
  "repo_token_user_email" TEXT,
  "repo_token_repo_role" TEXT,
  "repo_token_repo_role_json" JSONB,
  "prompt_default" TEXT,
  "language" TEXT,
  "model_provider" TEXT NOT NULL DEFAULT 'codex',
  "model_provider_config_json" JSONB,
  "default_branch_role" TEXT,
  "default_branch" TEXT,
  "activated_at" TIMESTAMPTZ,
  "last_test_at" TIMESTAMPTZ,
  "last_test_ok" BOOLEAN,
  "last_test_message" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "repo_robots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "repo_robots"
ADD CONSTRAINT "repo_robots_repo_id_fkey"
FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "repo_robots_repo_id_idx" ON "repo_robots" ("repo_id");

CREATE TABLE "repo_automation_configs" (
  "repo_id" UUID NOT NULL,
  "config_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "repo_automation_configs_pkey" PRIMARY KEY ("repo_id")
);

ALTER TABLE "repo_automation_configs"
ADD CONSTRAINT "repo_automation_configs_repo_id_fkey"
FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

