CREATE TYPE "ScaleLicenseStatus" AS ENUM ('UNKNOWN', 'INTERNAL_REVIEW', 'AUTHORIZED_INTERNAL', 'AUTHORIZED_COMMERCIAL', 'RESTRICTED', 'EXPIRED');
CREATE TYPE "DoctorReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO', 'SUPERSEDED');
CREATE TYPE "AssessmentReportStatus" AS ENUM ('DRAFT', 'PENDING_DOCTOR_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "ReportTemplateStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "EducationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "FollowUpTaskType" AS ENUM ('ONE_MONTH', 'THREE_MONTH', 'CUSTOM');
CREATE TYPE "FollowUpTaskStatus" AS ENUM ('PENDING', 'REMINDED', 'COMPLETED', 'CANCELLED', 'LOST_TO_FOLLOWUP');
CREATE TYPE "ReminderChannel" AS ENUM ('MANUAL_PHONE', 'MANUAL_WECHAT', 'IN_PERSON', 'OTHER');
CREATE TYPE "ReminderStatus" AS ENUM ('RECORDED', 'ACKNOWLEDGED', 'FAILED');
CREATE TYPE "ResearchImportBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'IMPORTED', 'FAILED', 'CANCELLED');
CREATE TYPE "AiDecisionType" AS ENUM ('QUESTION_EXPLANATION', 'ANSWER_MAPPING', 'LOW_CONFIDENCE_CONFIRMATION', 'PARENT_EXPLANATION', 'DOCTOR_SUMMARY', 'EDUCATION_MATCH', 'SAFETY_REVIEW');
CREATE TYPE "McpToolCallStatus" AS ENUM ('SUCCESS', 'ERROR');

CREATE TABLE "scale_license_metadata" (
  "id" TEXT NOT NULL,
  "scaleId" TEXT NOT NULL,
  "scaleVersion" TEXT NOT NULL DEFAULT '1.0',
  "licenseStatus" "ScaleLicenseStatus" NOT NULL DEFAULT 'UNKNOWN',
  "usageScope" TEXT NOT NULL DEFAULT 'internal_research_trial',
  "commercialEnabled" BOOLEAN NOT NULL DEFAULT false,
  "sourceName" TEXT,
  "sourceUrl" TEXT,
  "copyrightNotice" TEXT,
  "licenseNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scale_license_metadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctor_review" (
  "id" TEXT NOT NULL,
  "assessmentSessionId" TEXT,
  "assessmentHistoryId" TEXT,
  "memberProfileId" TEXT,
  "doctorProfileId" TEXT NOT NULL,
  "status" "DoctorReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewConclusion" TEXT,
  "reviewNotes" TEXT,
  "allowParentVisible" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "doctor_review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_template" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL DEFAULT '1.0',
  "hospitalName" TEXT NOT NULL DEFAULT '解放军总医院第一医学中心',
  "departmentName" TEXT,
  "logoUrl" TEXT,
  "doctorSignatureConfig" JSONB,
  "scaleIds" JSONB NOT NULL,
  "status" "ReportTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdByDoctorProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "report_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_report" (
  "id" TEXT NOT NULL,
  "reportNo" TEXT NOT NULL,
  "assessmentSessionId" TEXT,
  "assessmentHistoryId" TEXT,
  "memberProfileId" TEXT,
  "doctorReviewId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "scaleId" TEXT NOT NULL,
  "reportStatus" "AssessmentReportStatus" NOT NULL DEFAULT 'DRAFT',
  "reportSnapshot" JSONB NOT NULL,
  "parentVisible" BOOLEAN NOT NULL DEFAULT false,
  "pdfUrl" TEXT,
  "approvedByDoctorProfileId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assessment_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "education_content" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "contentMd" TEXT NOT NULL,
  "summary" TEXT,
  "status" "KnowledgeReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "scaleId" TEXT,
  "dimensionKey" TEXT,
  "riskLevel" TEXT,
  "audience" TEXT NOT NULL DEFAULT 'caregiver',
  "sourceDocId" TEXT,
  "createdByDoctorProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "education_content_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "education_delivery" (
  "id" TEXT NOT NULL,
  "educationContentId" TEXT NOT NULL,
  "memberProfileId" TEXT,
  "assessmentReportId" TEXT,
  "assessmentHistoryId" TEXT,
  "assessmentSessionId" TEXT,
  "doctorProfileId" TEXT,
  "deliveryStatus" "EducationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "education_delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "followup_task" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "baselineAssessmentHistoryId" TEXT,
  "baselineAssessmentSessionId" TEXT,
  "scaleId" TEXT NOT NULL,
  "taskType" "FollowUpTaskType" NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "windowStartAt" TIMESTAMP(3) NOT NULL,
  "windowEndAt" TIMESTAMP(3) NOT NULL,
  "status" "FollowUpTaskStatus" NOT NULL DEFAULT 'PENDING',
  "completedAssessmentHistoryId" TEXT,
  "completedAssessmentSessionId" TEXT,
  "lostToFollowupReason" TEXT,
  "createdByDoctorProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "followup_task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reminder_log" (
  "id" TEXT NOT NULL,
  "followUpTaskId" TEXT NOT NULL,
  "memberProfileId" TEXT,
  "doctorProfileId" TEXT,
  "reminderChannel" "ReminderChannel" NOT NULL DEFAULT 'MANUAL_PHONE',
  "status" "ReminderStatus" NOT NULL DEFAULT 'RECORDED',
  "messageSummary" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "research_import_batch" (
  "id" TEXT NOT NULL,
  "uploadedByDoctorProfileId" TEXT,
  "requestedByUserId" TEXT,
  "sourceName" TEXT NOT NULL,
  "status" "ResearchImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "fieldMapping" JSONB NOT NULL,
  "qualitySummary" JSONB,
  "importedRowCount" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "research_import_batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_decision_log" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "memberProfileId" TEXT,
  "assessmentHistoryId" TEXT,
  "assessmentSessionId" TEXT,
  "doctorProfileId" TEXT,
  "decisionType" "AiDecisionType" NOT NULL,
  "modelName" TEXT,
  "promptHash" TEXT,
  "inputSummary" TEXT,
  "outputSummary" TEXT,
  "confidence" DOUBLE PRECISION,
  "fallbackReason" TEXT,
  "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
  "toolCalls" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_decision_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_tool_log" (
  "id" TEXT NOT NULL,
  "apiKeyId" TEXT,
  "userId" TEXT,
  "assessmentHistoryId" TEXT,
  "assessmentSessionId" TEXT,
  "toolName" TEXT NOT NULL,
  "requestId" TEXT,
  "argumentsSummary" JSONB,
  "resultSummary" JSONB,
  "status" "McpToolCallStatus" NOT NULL DEFAULT 'SUCCESS',
  "success" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" TEXT,
  "latencyMs" INTEGER,
  "entrypoint" TEXT NOT NULL DEFAULT 'canonical',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mcp_tool_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scale_license_metadata_scaleId_scaleVersion_key" ON "scale_license_metadata"("scaleId", "scaleVersion");
CREATE INDEX "scale_license_metadata_licenseStatus_idx" ON "scale_license_metadata"("licenseStatus");
CREATE INDEX "scale_license_metadata_commercialEnabled_idx" ON "scale_license_metadata"("commercialEnabled");

CREATE INDEX "doctor_review_status_createdAt_idx" ON "doctor_review"("status", "createdAt");
CREATE INDEX "doctor_review_doctorProfileId_status_createdAt_idx" ON "doctor_review"("doctorProfileId", "status", "createdAt");
CREATE INDEX "doctor_review_memberProfileId_createdAt_idx" ON "doctor_review"("memberProfileId", "createdAt");
CREATE INDEX "doctor_review_assessmentHistoryId_idx" ON "doctor_review"("assessmentHistoryId");
CREATE INDEX "doctor_review_assessmentSessionId_idx" ON "doctor_review"("assessmentSessionId");

CREATE INDEX "report_template_status_isDefault_idx" ON "report_template"("status", "isDefault");
CREATE INDEX "report_template_createdByDoctorProfileId_idx" ON "report_template"("createdByDoctorProfileId");

CREATE UNIQUE INDEX "assessment_report_reportNo_key" ON "assessment_report"("reportNo");
CREATE INDEX "assessment_report_memberProfileId_createdAt_idx" ON "assessment_report"("memberProfileId", "createdAt");
CREATE INDEX "assessment_report_doctorReviewId_idx" ON "assessment_report"("doctorReviewId");
CREATE INDEX "assessment_report_templateId_idx" ON "assessment_report"("templateId");
CREATE INDEX "assessment_report_reportStatus_createdAt_idx" ON "assessment_report"("reportStatus", "createdAt");
CREATE INDEX "assessment_report_approvedByDoctorProfileId_approvedAt_idx" ON "assessment_report"("approvedByDoctorProfileId", "approvedAt");

CREATE INDEX "education_content_status_scaleId_idx" ON "education_content"("status", "scaleId");
CREATE INDEX "education_content_sourceDocId_idx" ON "education_content"("sourceDocId");
CREATE INDEX "education_content_createdByDoctorProfileId_idx" ON "education_content"("createdByDoctorProfileId");

CREATE INDEX "education_delivery_memberProfileId_deliveryStatus_createdAt_idx" ON "education_delivery"("memberProfileId", "deliveryStatus", "createdAt");
CREATE INDEX "education_delivery_educationContentId_createdAt_idx" ON "education_delivery"("educationContentId", "createdAt");
CREATE INDEX "education_delivery_assessmentReportId_idx" ON "education_delivery"("assessmentReportId");
CREATE INDEX "education_delivery_doctorProfileId_createdAt_idx" ON "education_delivery"("doctorProfileId", "createdAt");

CREATE INDEX "followup_task_memberProfileId_status_dueDate_idx" ON "followup_task"("memberProfileId", "status", "dueDate");
CREATE INDEX "followup_task_taskType_dueDate_idx" ON "followup_task"("taskType", "dueDate");
CREATE INDEX "followup_task_baselineAssessmentHistoryId_idx" ON "followup_task"("baselineAssessmentHistoryId");
CREATE INDEX "followup_task_completedAssessmentHistoryId_idx" ON "followup_task"("completedAssessmentHistoryId");
CREATE INDEX "followup_task_createdByDoctorProfileId_idx" ON "followup_task"("createdByDoctorProfileId");

CREATE INDEX "reminder_log_followUpTaskId_recordedAt_idx" ON "reminder_log"("followUpTaskId", "recordedAt");
CREATE INDEX "reminder_log_memberProfileId_recordedAt_idx" ON "reminder_log"("memberProfileId", "recordedAt");
CREATE INDEX "reminder_log_doctorProfileId_recordedAt_idx" ON "reminder_log"("doctorProfileId", "recordedAt");

CREATE INDEX "research_import_batch_status_createdAt_idx" ON "research_import_batch"("status", "createdAt");
CREATE INDEX "research_import_batch_uploadedByDoctorProfileId_createdAt_idx" ON "research_import_batch"("uploadedByDoctorProfileId", "createdAt");
CREATE INDEX "research_import_batch_requestedByUserId_createdAt_idx" ON "research_import_batch"("requestedByUserId", "createdAt");

CREATE INDEX "ai_decision_log_decisionType_createdAt_idx" ON "ai_decision_log"("decisionType", "createdAt");
CREATE INDEX "ai_decision_log_memberProfileId_createdAt_idx" ON "ai_decision_log"("memberProfileId", "createdAt");
CREATE INDEX "ai_decision_log_assessmentSessionId_createdAt_idx" ON "ai_decision_log"("assessmentSessionId", "createdAt");
CREATE INDEX "ai_decision_log_doctorProfileId_createdAt_idx" ON "ai_decision_log"("doctorProfileId", "createdAt");

CREATE INDEX "mcp_tool_log_toolName_createdAt_idx" ON "mcp_tool_log"("toolName", "createdAt");
CREATE INDEX "mcp_tool_log_apiKeyId_createdAt_idx" ON "mcp_tool_log"("apiKeyId", "createdAt");
CREATE INDEX "mcp_tool_log_assessmentSessionId_createdAt_idx" ON "mcp_tool_log"("assessmentSessionId", "createdAt");
CREATE INDEX "mcp_tool_log_status_createdAt_idx" ON "mcp_tool_log"("status", "createdAt");

ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_template" ADD CONSTRAINT "report_template_createdByDoctorProfileId_fkey" FOREIGN KEY ("createdByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_doctorReviewId_fkey" FOREIGN KEY ("doctorReviewId") REFERENCES "doctor_review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "report_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_approvedByDoctorProfileId_fkey" FOREIGN KEY ("approvedByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "education_content" ADD CONSTRAINT "education_content_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "KnowledgeDoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "education_content" ADD CONSTRAINT "education_content_createdByDoctorProfileId_fkey" FOREIGN KEY ("createdByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_educationContentId_fkey" FOREIGN KEY ("educationContentId") REFERENCES "education_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_assessmentReportId_fkey" FOREIGN KEY ("assessmentReportId") REFERENCES "assessment_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_baselineAssessmentHistoryId_fkey" FOREIGN KEY ("baselineAssessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_baselineAssessmentSessionId_fkey" FOREIGN KEY ("baselineAssessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_completedAssessmentHistoryId_fkey" FOREIGN KEY ("completedAssessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_completedAssessmentSessionId_fkey" FOREIGN KEY ("completedAssessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_createdByDoctorProfileId_fkey" FOREIGN KEY ("createdByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_followUpTaskId_fkey" FOREIGN KEY ("followUpTaskId") REFERENCES "followup_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "research_import_batch" ADD CONSTRAINT "research_import_batch_uploadedByDoctorProfileId_fkey" FOREIGN KEY ("uploadedByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "research_import_batch" ADD CONSTRAINT "research_import_batch_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
