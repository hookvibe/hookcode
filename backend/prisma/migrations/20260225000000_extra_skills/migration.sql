-- Add global extra skill registry storage with prompt injection flags. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
CREATE TABLE "extra_skills" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "prompt_text" TEXT,
  "prompt_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "storage_path" TEXT NOT NULL,
  "checksum" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "extra_skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "extra_skills_slug_unique" ON "extra_skills"("slug");
CREATE INDEX "extra_skills_enabled_created_at_idx" ON "extra_skills"("enabled", "created_at");
