-- Replace direct worker bootstrap secrets with one-time bind codes.
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "bind_code_hash" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "bind_code_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "bind_code_used_at" TIMESTAMPTZ(6);
