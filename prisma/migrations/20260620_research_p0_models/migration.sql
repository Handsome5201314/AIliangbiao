CREATE TABLE "child_baseline" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "researchSubjectId" TEXT NOT NULL,
  "birthYear" INTEGER,
  "birthMonth" INTEGER,
  "sex" TEXT,
  "city" TEXT,
  "chiefComplaint" TEXT,
  "baselineSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "child_baseline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scale_score" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT,
  "assessmentHistoryId" TEXT,
  "assessmentSessionId" TEXT,
  "scaleId" TEXT NOT NULL,
  "scaleVersion" TEXT NOT NULL DEFAULT '1.0',
  "questionId" TEXT NOT NULL,
  "answer" JSONB NOT NULL,
  "score" DOUBLE PRECISION,
  "domainKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scale_score_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "followup" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "assessmentHistoryId" TEXT,
  "assessmentSessionId" TEXT,
  "doctorProfileId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "reminderClickedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "followup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_interaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "memberProfileId" TEXT,
  "assessmentHistoryId" TEXT,
  "assessmentSessionId" TEXT,
  "doctorProfileId" TEXT,
  "scaleId" TEXT,
  "questionId" TEXT,
  "interactionType" TEXT NOT NULL,
  "promptHash" TEXT,
  "responseSummary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_interaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_view" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "memberProfileId" TEXT,
  "assessmentHistoryId" TEXT,
  "assessmentSessionId" TEXT,
  "doctorProfileId" TEXT,
  "viewerRole" TEXT NOT NULL,
  "metadata" JSONB,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_view_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outcome_3m" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "assessmentSessionId" TEXT,
  "baselineScore" DOUBLE PRECISION,
  "followUpScore" DOUBLE PRECISION,
  "scoreChange" DOUBLE PRECISION,
  "interventionStarted" BOOLEAN,
  "measuredAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outcome_3m_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inpatient_record" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "doctorProfileId" TEXT,
  "admissionId" TEXT NOT NULL,
  "admissionDate" TIMESTAMP(3),
  "dischargeDate" TIMESTAMP(3),
  "treatmentType" TEXT,
  "hospitalName" TEXT,
  "departmentName" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inpatient_record_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "child_baseline_memberProfileId_key" ON "child_baseline"("memberProfileId");
CREATE UNIQUE INDEX "child_baseline_researchSubjectId_key" ON "child_baseline"("researchSubjectId");
CREATE INDEX "child_baseline_researchSubjectId_idx" ON "child_baseline"("researchSubjectId");
CREATE INDEX "child_baseline_sex_birthYear_idx" ON "child_baseline"("sex", "birthYear");

CREATE INDEX "scale_score_memberProfileId_scaleId_idx" ON "scale_score"("memberProfileId", "scaleId");
CREATE INDEX "scale_score_assessmentHistoryId_idx" ON "scale_score"("assessmentHistoryId");
CREATE INDEX "scale_score_assessmentSessionId_idx" ON "scale_score"("assessmentSessionId");
CREATE INDEX "scale_score_scaleId_questionId_idx" ON "scale_score"("scaleId", "questionId");

CREATE INDEX "followup_memberProfileId_status_createdAt_idx" ON "followup"("memberProfileId", "status", "createdAt");
CREATE INDEX "followup_assessmentSessionId_idx" ON "followup"("assessmentSessionId");
CREATE INDEX "followup_assessmentHistoryId_idx" ON "followup"("assessmentHistoryId");
CREATE INDEX "followup_doctorProfileId_createdAt_idx" ON "followup"("doctorProfileId", "createdAt");

CREATE INDEX "ai_interaction_userId_createdAt_idx" ON "ai_interaction"("userId", "createdAt");
CREATE INDEX "ai_interaction_memberProfileId_createdAt_idx" ON "ai_interaction"("memberProfileId", "createdAt");
CREATE INDEX "ai_interaction_assessmentSessionId_createdAt_idx" ON "ai_interaction"("assessmentSessionId", "createdAt");
CREATE INDEX "ai_interaction_scaleId_questionId_createdAt_idx" ON "ai_interaction"("scaleId", "questionId", "createdAt");

CREATE INDEX "report_view_userId_viewedAt_idx" ON "report_view"("userId", "viewedAt");
CREATE INDEX "report_view_memberProfileId_viewedAt_idx" ON "report_view"("memberProfileId", "viewedAt");
CREATE INDEX "report_view_assessmentSessionId_viewedAt_idx" ON "report_view"("assessmentSessionId", "viewedAt");
CREATE INDEX "report_view_doctorProfileId_viewedAt_idx" ON "report_view"("doctorProfileId", "viewedAt");

CREATE INDEX "outcome_3m_memberProfileId_measuredAt_idx" ON "outcome_3m"("memberProfileId", "measuredAt");
CREATE INDEX "outcome_3m_assessmentSessionId_idx" ON "outcome_3m"("assessmentSessionId");

CREATE UNIQUE INDEX "inpatient_record_admissionId_key" ON "inpatient_record"("admissionId");
CREATE INDEX "inpatient_record_memberProfileId_admissionDate_idx" ON "inpatient_record"("memberProfileId", "admissionDate");
CREATE INDEX "inpatient_record_doctorProfileId_admissionDate_idx" ON "inpatient_record"("doctorProfileId", "admissionDate");

ALTER TABLE "child_baseline" ADD CONSTRAINT "child_baseline_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scale_score" ADD CONSTRAINT "scale_score_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scale_score" ADD CONSTRAINT "scale_score_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scale_score" ADD CONSTRAINT "scale_score_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "followup" ADD CONSTRAINT "followup_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "followup" ADD CONSTRAINT "followup_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "followup" ADD CONSTRAINT "followup_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "followup" ADD CONSTRAINT "followup_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outcome_3m" ADD CONSTRAINT "outcome_3m_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_3m" ADD CONSTRAINT "outcome_3m_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inpatient_record" ADD CONSTRAINT "inpatient_record_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inpatient_record" ADD CONSTRAINT "inpatient_record_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
