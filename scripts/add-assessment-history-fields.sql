ALTER TABLE "AssessmentHistory"
ADD COLUMN IF NOT EXISTS "formData" JSONB;

ALTER TABLE "AssessmentHistory"
ADD COLUMN IF NOT EXISTS "resultDetails" JSONB;
