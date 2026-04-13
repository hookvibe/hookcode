-- Create the admin-managed global credential store for shared provider profiles. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
CREATE TABLE "global_credential_settings" (
  "id" TEXT NOT NULL,
  "repo_provider_credentials_json" JSONB,
  "model_provider_credentials_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_credential_settings_pkey" PRIMARY KEY ("id")
);

-- Create the global robot catalog so repositories can execute shared robots without duplicating config. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
CREATE TABLE "global_robots" (
  "id" UUID NOT NULL,
  "default_worker_id" UUID,
  "name" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "repo_credential_profile_id" TEXT,
  "repo_credential_source" TEXT,
  "repo_workflow_mode" TEXT,
  "time_window_start_hour" INTEGER,
  "time_window_end_hour" INTEGER,
  "prompt_default" TEXT,
  "language" TEXT,
  "model_provider" TEXT NOT NULL DEFAULT 'codex',
  "model_provider_config_json" JSONB,
  "dependency_config_json" JSONB,
  "default_branch_role" TEXT,
  "default_branch" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_robots_pkey" PRIMARY KEY ("id")
);

-- Link global robots to the shared worker registry for cross-repo execution routing. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
ALTER TABLE "global_robots"
ADD CONSTRAINT "global_robots_default_worker_id_fkey"
FOREIGN KEY ("default_worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "global_robots_enabled_created_at_idx" ON "global_robots" ("enabled", "created_at");
CREATE INDEX "global_robots_default_permission_idx" ON "global_robots" ("is_default", "permission");
CREATE INDEX "global_robots_default_worker_id_idx" ON "global_robots" ("default_worker_id");
