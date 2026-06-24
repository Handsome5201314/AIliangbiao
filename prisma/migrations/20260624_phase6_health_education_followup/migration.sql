ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'EDUCATION_CONTENT';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'EDUCATION_DELIVERY';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'FOLLOWUP_TASK';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'REMINDER_LOG';

ALTER TABLE "education_content"
  ADD COLUMN IF NOT EXISTS "reviewedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewComment" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "education_content_reviewedByAdminId_reviewedAt_idx"
  ON "education_content"("reviewedByAdminId", "reviewedAt");
