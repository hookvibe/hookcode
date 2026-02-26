-- Add auth + RBAC user fields. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
ALTER TABLE "users"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "email_lower" TEXT,
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" ("email_lower");

-- Create repo membership table for RBAC. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
CREATE TABLE "repo_members" (
  "id" UUID NOT NULL,
  "repo_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "repo_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repo_members_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE,
  CONSTRAINT "repo_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "repo_members_repo_user_unique" ON "repo_members" ("repo_id", "user_id");
CREATE INDEX "repo_members_user_id_idx" ON "repo_members" ("user_id");

-- Create repo member invite table. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
CREATE TABLE "repo_member_invites" (
  "id" UUID NOT NULL,
  "repo_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "email_lower" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "invited_by_user_id" UUID NOT NULL,
  "invited_user_id" UUID,
  "accepted_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "repo_member_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repo_member_invites_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE,
  CONSTRAINT "repo_member_invites_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "repo_member_invites_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "repo_member_invites_repo_id_idx" ON "repo_member_invites" ("repo_id");
CREATE INDEX "repo_member_invites_email_idx" ON "repo_member_invites" ("email_lower");
CREATE INDEX "repo_member_invites_token_hash_idx" ON "repo_member_invites" ("token_hash");

-- Create email verification token table. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
CREATE TABLE "email_verification_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "email_lower" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens" ("user_id");
CREATE INDEX "email_verification_tokens_email_idx" ON "email_verification_tokens" ("email_lower");
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_unique" ON "email_verification_tokens" ("token_hash");
