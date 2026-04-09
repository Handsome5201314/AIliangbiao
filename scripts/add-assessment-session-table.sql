CREATE TABLE IF NOT EXISTS "AssessmentSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profileId" TEXT,
  "scaleId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "channel" TEXT NOT NULL DEFAULT 'web',
  "currentQuestionIndex" INTEGER,
  "answers" JSONB NOT NULL,
  "formData" JSONB,
  "conversationState" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssessmentSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AssessmentSession_userId_status_updatedAt_idx"
ON "AssessmentSession"("userId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "AssessmentSession_profileId_status_updatedAt_idx"
ON "AssessmentSession"("profileId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "AssessmentSession_scaleId_status_idx"
ON "AssessmentSession"("scaleId", "status");
