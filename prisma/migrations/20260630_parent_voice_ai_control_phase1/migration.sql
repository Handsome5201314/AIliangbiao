-- Phase 1: parent voice answering AI conversation source of truth.

UPDATE "ApiKey"
SET "serviceType" = 'text'
WHERE "serviceType" IS NULL
   OR "serviceType" NOT IN ('text', 'speech', 'asr', 'tts');

UPDATE "ApiKey"
SET "serviceType" = 'asr'
WHERE "serviceType" = 'speech';

ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_serviceType_ai_modality_check"
  CHECK ("serviceType" IN ('text', 'asr', 'tts'));

CREATE TABLE "ai_conversation_session" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "memberProfileId" TEXT,
  "assessmentSessionId" TEXT,
  "assessmentHistoryId" TEXT,
  "doctorProfileId" TEXT,
  "scaleId" TEXT,
  "questionId" INTEGER,
  "hermesConversationId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'parent_voice',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "provider" TEXT,
  "model" TEXT,
  "promptHash" TEXT,
  "configVersion" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "ai_conversation_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_conversation_event" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "memberProfileId" TEXT,
  "assessmentSessionId" TEXT,
  "assessmentHistoryId" TEXT,
  "doctorProfileId" TEXT,
  "eventType" TEXT NOT NULL,
  "scaleId" TEXT,
  "questionId" INTEGER,
  "hermesConversationId" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "confidence" DOUBLE PRECISION,
  "confirmedLowConfidence" BOOLEAN NOT NULL DEFAULT false,
  "promptHash" TEXT,
  "configVersion" TEXT,
  "transcriptText" TEXT,
  "assistantText" TEXT,
  "summary" TEXT,
  "errorMessage" TEXT,
  "fallbackReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_conversation_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "aics_user_created_idx" ON "ai_conversation_session"("userId", "createdAt");
CREATE INDEX "aics_member_created_idx" ON "ai_conversation_session"("memberProfileId", "createdAt");
CREATE INDEX "aics_as_created_idx" ON "ai_conversation_session"("assessmentSessionId", "createdAt");
CREATE INDEX "aics_ah_created_idx" ON "ai_conversation_session"("assessmentHistoryId", "createdAt");
CREATE INDEX "aics_doctor_created_idx" ON "ai_conversation_session"("doctorProfileId", "createdAt");
CREATE INDEX "aics_scale_question_created_idx" ON "ai_conversation_session"("scaleId", "questionId", "createdAt");
CREATE INDEX "aics_hermes_idx" ON "ai_conversation_session"("hermesConversationId");
CREATE INDEX "aics_status_created_idx" ON "ai_conversation_session"("status", "createdAt");

CREATE INDEX "aice_session_created_idx" ON "ai_conversation_event"("sessionId", "createdAt");
CREATE INDEX "aice_event_created_idx" ON "ai_conversation_event"("eventType", "createdAt");
CREATE INDEX "aice_member_created_idx" ON "ai_conversation_event"("memberProfileId", "createdAt");
CREATE INDEX "aice_as_created_idx" ON "ai_conversation_event"("assessmentSessionId", "createdAt");
CREATE INDEX "aice_ah_created_idx" ON "ai_conversation_event"("assessmentHistoryId", "createdAt");
CREATE INDEX "aice_doctor_created_idx" ON "ai_conversation_event"("doctorProfileId", "createdAt");
CREATE INDEX "aice_scale_question_created_idx" ON "ai_conversation_event"("scaleId", "questionId", "createdAt");
CREATE INDEX "aice_provider_model_created_idx" ON "ai_conversation_event"("provider", "model", "createdAt");
CREATE INDEX "aice_confirmed_low_created_idx" ON "ai_conversation_event"("confirmedLowConfidence", "createdAt");

ALTER TABLE "ai_conversation_session"
  ADD CONSTRAINT "aics_user_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aics_member_fk" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aics_assessment_session_fk" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aics_assessment_history_fk" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aics_doctor_fk" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_conversation_event"
  ADD CONSTRAINT "aice_session_fk" FOREIGN KEY ("sessionId") REFERENCES "ai_conversation_session"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "aice_user_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aice_member_fk" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aice_assessment_session_fk" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aice_assessment_history_fk" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "aice_doctor_fk" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
