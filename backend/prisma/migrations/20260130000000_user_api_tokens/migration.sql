-- Add user API tokens for PAT access. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
CREATE TABLE "user_api_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "token_prefix" TEXT NOT NULL,
  "token_last4" TEXT,
  "scopes_json" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "last_used_at" TIMESTAMPTZ(6),
  "last_used_ip" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_api_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_api_tokens_token_hash_unique" ON "user_api_tokens"("token_hash");
CREATE INDEX "user_api_tokens_user_created_at_idx" ON "user_api_tokens"("user_id", "created_at");
