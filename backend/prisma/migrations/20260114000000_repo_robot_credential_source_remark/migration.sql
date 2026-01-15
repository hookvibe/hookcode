-- Change record:
-- - 2026-01-14: Add repo provider credential source + remark fields to `repo_robots` so robots can
--   (1) explicitly select the credential scope (robot/user/repo) when multiple profiles exist and
--   (2) store a user-defined note for per-robot repo tokens.

ALTER TABLE "repo_robots"
ADD COLUMN "repo_credential_source" TEXT,
ADD COLUMN "repo_credential_remark" TEXT;

