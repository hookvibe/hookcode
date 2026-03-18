-- Extend repo webhook deliveries into a replay/debug event store. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
ALTER TABLE "repo_webhook_deliveries"
  ADD COLUMN IF NOT EXISTS "mapped_event_type" TEXT,
  ADD COLUMN IF NOT EXISTS "payload_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "signature_verified" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "error_layer" TEXT,
  ADD COLUMN IF NOT EXISTS "matched_rule_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "matched_robot_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "task_group_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "replay_of_event_id" UUID,
  ADD COLUMN IF NOT EXISTS "replay_mode" TEXT,
  ADD COLUMN IF NOT EXISTS "debug_trace_json" JSONB,
  ADD COLUMN IF NOT EXISTS "dry_run_result_json" JSONB;

CREATE INDEX IF NOT EXISTS "repo_webhook_deliveries_result_created_at_idx"
  ON "repo_webhook_deliveries"("result", "created_at");

CREATE INDEX IF NOT EXISTS "repo_webhook_deliveries_error_layer_created_at_idx"
  ON "repo_webhook_deliveries"("error_layer", "created_at");

CREATE INDEX IF NOT EXISTS "repo_webhook_deliveries_replay_of_event_created_at_idx"
  ON "repo_webhook_deliveries"("replay_of_event_id", "created_at");

CREATE INDEX IF NOT EXISTS "repo_webhook_deliveries_payload_hash_idx"
  ON "repo_webhook_deliveries"("payload_hash");
