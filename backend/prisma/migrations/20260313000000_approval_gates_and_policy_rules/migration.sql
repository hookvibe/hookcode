-- Add approval requests/actions and repo-scoped policy rules for approval gates. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313
CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" UUID PRIMARY KEY,
  "task_id" UUID NOT NULL,
  "repo_id" UUID,
  "robot_id" UUID,
  "requested_by_user_id" UUID,
  "resolved_by_user_id" UUID,
  "status" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details_json" JSONB,
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "approval_actions" (
  "id" UUID PRIMARY KEY,
  "approval_request_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "policy_rules" (
  "id" UUID PRIMARY KEY,
  "repo_id" UUID,
  "robot_id" UUID,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "action" TEXT NOT NULL,
  "conditions_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'approval_requests_task_id_fkey'
  ) THEN
    ALTER TABLE "approval_requests"
      ADD CONSTRAINT "approval_requests_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'approval_actions_approval_request_id_fkey'
  ) THEN
    ALTER TABLE "approval_actions"
      ADD CONSTRAINT "approval_actions_approval_request_id_fkey"
      FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "approval_requests_task_id_created_at_idx" ON "approval_requests"("task_id", "created_at");
CREATE INDEX IF NOT EXISTS "approval_requests_status_created_at_idx" ON "approval_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "approval_requests_repo_status_created_at_idx" ON "approval_requests"("repo_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "approval_actions_request_created_at_idx" ON "approval_actions"("approval_request_id", "created_at");
CREATE INDEX IF NOT EXISTS "policy_rules_scope_enabled_priority_idx" ON "policy_rules"("repo_id", "robot_id", "enabled", "priority");
CREATE INDEX IF NOT EXISTS "policy_rules_enabled_priority_created_at_idx" ON "policy_rules"("enabled", "priority", "created_at");
