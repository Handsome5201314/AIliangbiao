-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GUEST', 'REGISTERED', 'VIP');

-- CreateEnum
CREATE TYPE "AuthVerificationPurpose" AS ENUM ('REGISTER', 'LOGIN', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PATIENT', 'DOCTOR');

-- CreateEnum
CREATE TYPE "MemberRelation" AS ENUM ('SELF', 'CHILD', 'PARENT', 'SPOUSE', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "LanguagePreference" AS ENUM ('ZH', 'EN');

-- CreateEnum
CREATE TYPE "CareTeamRole" AS ENUM ('LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "CareAccessRole" AS ENUM ('COLLABORATOR', 'READONLY');

-- CreateEnum
CREATE TYPE "CollaborationResourceType" AS ENUM ('PATIENT_MEMBER', 'NEONATE_ARCHIVE', 'CARE_TEAM');

-- CreateEnum
CREATE TYPE "DoctorVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "HermesProfileOwnerType" AS ENUM ('ORGANIZATION', 'DOCTOR');

-- CreateEnum
CREATE TYPE "HermesProfileStatus" AS ENUM ('DRAFT', 'READY', 'DEGRADED', 'DISABLED');

-- CreateEnum
CREATE TYPE "KnowledgeScopeType" AS ENUM ('PLATFORM', 'ORGANIZATION', 'DOCTOR');

-- CreateEnum
CREATE TYPE "KnowledgeReviewStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'DOCTOR', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('MEMBER_PROFILE', 'KNOWLEDGE_DOC', 'QUESTION_EXPLANATION', 'EDUCATION_CONTENT', 'EDUCATION_DELIVERY', 'FOLLOWUP_TASK', 'REMINDER_LOG', 'AGENT_SESSION', 'ORGANIZATION', 'HERMES_PROFILE');

-- CreateEnum
CREATE TYPE "CareAssignmentStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "DoctorPatientNoteType" AS ENUM ('CLINICAL', 'RESEARCH');

-- CreateEnum
CREATE TYPE "ResearchConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ResearchExportFormat" AS ENUM ('CSV', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ApiKeyPurpose" AS ENUM ('AI', 'MCP');

-- CreateEnum
CREATE TYPE "DoctorScaleInviteStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClinicScreeningSubmissionStatus" AS ENUM ('SUBMITTED', 'CLAIMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DoctorNeonateBilirubinContext" AS ENUM ('AMBIENT', 'PHOTOTHERAPY');

-- CreateEnum
CREATE TYPE "ScaleLicenseStatus" AS ENUM ('UNKNOWN', 'INTERNAL_REVIEW', 'AUTHORIZED_INTERNAL', 'AUTHORIZED_COMMERCIAL', 'RESTRICTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DoctorReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AssessmentReportStatus" AS ENUM ('DRAFT', 'PENDING_DOCTOR_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ReportTemplateStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EducationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FollowUpTaskType" AS ENUM ('ONE_MONTH', 'THREE_MONTH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FollowUpTaskStatus" AS ENUM ('PENDING', 'REMINDED', 'COMPLETED', 'CANCELLED', 'LOST_TO_FOLLOWUP');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('MANUAL_PHONE', 'MANUAL_WECHAT', 'IN_PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('RECORDED', 'ACKNOWLEDGED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResearchImportBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'IMPORTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiDecisionType" AS ENUM ('QUESTION_EXPLANATION', 'ANSWER_MAPPING', 'LOW_CONFIDENCE_CONFIRMATION', 'PARENT_EXPLANATION', 'DOCTOR_SUMMARY', 'EDUCATION_MATCH', 'SAFETY_REVIEW');

-- CreateEnum
CREATE TYPE "McpToolCallStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'GUEST',
    "accountType" "AccountType" NOT NULL DEFAULT 'PATIENT',
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "deviceId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "dailyUsed" INTEGER NOT NULL DEFAULT 0,
    "dailyLimit" INTEGER NOT NULL DEFAULT 5,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthVerificationCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "AuthVerificationPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relation" "MemberRelation" NOT NULL DEFAULT 'SELF',
    "languagePreference" "LanguagePreference" NOT NULL DEFAULT 'ZH',
    "nickname" TEXT NOT NULL,
    "realName" TEXT,
    "contactPhone" TEXT,
    "gender" TEXT NOT NULL,
    "ageMonths" INTEGER,
    "pendingClaim" BOOLEAN NOT NULL DEFAULT false,
    "traits" JSONB NOT NULL,
    "avatarConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToyDeviceBinding" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiToyDeviceBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "scaleId" TEXT NOT NULL,
    "scaleVersion" TEXT NOT NULL DEFAULT '1.0',
    "totalScore" DOUBLE PRECISION NOT NULL,
    "conclusion" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "resultDetails" JSONB,
    "inviteId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DIRECT',
    "respondentRealName" TEXT,
    "respondentPhone" TEXT,
    "respondentGender" TEXT,
    "respondentAgeMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "scaleId" TEXT NOT NULL,
    "scaleVersion" TEXT NOT NULL DEFAULT '1.0',
    "channel" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ZH',
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "publicToken" TEXT,
    "publicTokenExpiresAt" TIMESTAMP(3),
    "answers" JSONB NOT NULL,
    "currentQuestionIndex" INTEGER DEFAULT 0,
    "totalScore" DOUBLE PRECISION,
    "conclusion" TEXT,
    "resultDetails" JSONB,
    "assessmentHistoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCallbackDelivery" (
    "id" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "deviceId" TEXT,
    "callbackUrl" TEXT NOT NULL,
    "callbackSecretEncrypted" TEXT,
    "callbackMetadata" JSONB,
    "eventType" TEXT NOT NULL DEFAULT 'assessment.completed',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentCallbackDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgCode" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "realName" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "verificationStatus" "DoctorVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "isOrganizationOwner" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HermesProfile" (
    "id" TEXT NOT NULL,
    "ownerType" "HermesProfileOwnerType" NOT NULL,
    "organizationId" TEXT,
    "doctorProfileId" TEXT,
    "displayName" TEXT,
    "status" "HermesProfileStatus" NOT NULL DEFAULT 'READY',
    "policyJson" JSONB,
    "configJson" JSONB,
    "lastHealthAt" TIMESTAMP(3),
    "lastHealthStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HermesProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL,
    "hermesProfileId" TEXT,
    "scopeType" "KnowledgeScopeType" NOT NULL DEFAULT 'PLATFORM',
    "organizationId" TEXT,
    "doctorProfileId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MARKDOWN',
    "summary" TEXT,
    "rawMd" TEXT NOT NULL,
    "renderedHtml" TEXT,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "status" "KnowledgeReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceFileName" TEXT,
    "uploadedByUserId" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "metadataJson" JSONB,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "scaleId" TEXT,
    "questionId" TEXT,
    "contentText" TEXT NOT NULL,
    "searchText" TEXT,
    "tokenCount" INTEGER,
    "embedding" vector,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionExplanation" (
    "id" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "scaleId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'zh',
    "scopeType" "KnowledgeScopeType" NOT NULL DEFAULT 'PLATFORM',
    "organizationId" TEXT,
    "doctorProfileId" TEXT,
    "title" TEXT,
    "contentMd" TEXT NOT NULL,
    "status" "KnowledgeReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "actorUserId" TEXT,
    "actorDoctorProfileId" TEXT,
    "actorAdminId" TEXT,
    "memberProfileId" TEXT,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorScaleInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "scaleVersion" TEXT NOT NULL DEFAULT '1.0',
    "status" "DoctorScaleInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "linkedMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorScaleInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicScreeningPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "collectionSource" TEXT NOT NULL DEFAULT 'IN_HOSPITAL',
    "locationLabel" TEXT,
    "departmentLabel" TEXT,
    "ownerDoctorProfileId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicScreeningPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicScaleQr" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicScaleQr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicScreeningSubmission" (
    "id" TEXT NOT NULL,
    "screeningCode" TEXT NOT NULL,
    "clinicScaleQrId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "userId" TEXT,
    "memberProfileId" TEXT,
    "guestSessionId" TEXT,
    "respondentName" TEXT NOT NULL,
    "respondentGender" TEXT NOT NULL,
    "respondentAgeMonths" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "resultSummary" JSONB NOT NULL,
    "assessmentHistoryId" TEXT,
    "status" "ClinicScreeningSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicScreeningSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareAssignment" (
    "id" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "assignedByPatientUserId" TEXT NOT NULL,
    "status" "CareAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareTeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "teamRole" "CareTeamRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareTeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberCareAccessGrant" (
    "id" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "sourceTeamId" TEXT NOT NULL,
    "accessRole" "CareAccessRole" NOT NULL,
    "grantedByDoctorProfileId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCareAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeonateArchiveAccessGrant" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "sourceTeamId" TEXT NOT NULL,
    "accessRole" "CareAccessRole" NOT NULL,
    "grantedByDoctorProfileId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeonateArchiveAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorCollaborationAuditLog" (
    "id" TEXT NOT NULL,
    "resourceType" "CollaborationResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorDoctorProfileId" TEXT,
    "targetDoctorProfileId" TEXT,
    "sourceTeamId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorCollaborationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorPatientNote" (
    "id" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "assessmentHistoryId" TEXT,
    "noteType" "DoctorPatientNoteType" NOT NULL DEFAULT 'CLINICAL',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorPatientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchConsent" (
    "id" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "status" "ResearchConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "projectCode" TEXT NOT NULL DEFAULT 'CHA-HPI-AI-SCALE-2026',
    "consentVersion" TEXT NOT NULL DEFAULT '2026.05.v1',
    "consentScope" JSONB,
    "consentTextHash" TEXT,
    "signatureName" TEXT,
    "guardianName" TEXT,
    "guardianRelation" TEXT,
    "consentChannel" TEXT NOT NULL DEFAULT 'patient_portal',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchExportLog" (
    "id" TEXT NOT NULL,
    "memberProfileId" TEXT,
    "doctorProfileId" TEXT,
    "requestedByUserId" TEXT,
    "requestedByAdminId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'DOCTOR',
    "format" "ResearchExportFormat" NOT NULL DEFAULT 'CSV',
    "purpose" TEXT NOT NULL,
    "exportBatchKey" TEXT,
    "datasetVersion" TEXT NOT NULL DEFAULT 'research-derived-v1',
    "fieldSetVersion" TEXT NOT NULL DEFAULT '2026.06.phase7',
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "exportedFields" JSONB NOT NULL,
    "tables" JSONB,
    "qualitySummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchExportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "research_import_row" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceRowHash" TEXT NOT NULL,
    "researchSubjectId" TEXT,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB NOT NULL,
    "qualityFlags" JSONB NOT NULL,
    "importStatus" TEXT NOT NULL DEFAULT 'VALIDATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_import_row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_field_mapping" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "canonicalField" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_field_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_derived_dataset" (
    "id" TEXT NOT NULL,
    "exportLogId" TEXT,
    "datasetVersion" TEXT NOT NULL DEFAULT 'research-derived-v1',
    "fieldSetVersion" TEXT NOT NULL DEFAULT '2026.06.phase7',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "primaryOutcome" JSONB NOT NULL,
    "secondaryOutcomes" JSONB NOT NULL,
    "qualitySummary" JSONB,
    "rowsSnapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_derived_dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "McpLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scaleId" TEXT,
    "entrypoint" TEXT NOT NULL DEFAULT 'legacy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthRecord" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ageMonths" INTEGER NOT NULL,
    "gestationalWeek" INTEGER,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "headCircumference" DOUBLE PRECISION,
    "weightPercentile" DOUBLE PRECISION,
    "heightPercentile" DOUBLE PRECISION,
    "headPercentile" DOUBLE PRECISION,
    "weightStatus" TEXT,
    "heightStatus" TEXT,
    "headStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "symptoms" JSONB NOT NULL,
    "conversationHistory" JSONB NOT NULL,
    "recommendedScale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "purpose" "ApiKeyPurpose" NOT NULL DEFAULT 'AI',
    "provider" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "keyValue" TEXT,
    "secretCiphertext" TEXT,
    "secretHash" TEXT,
    "secretPreview" TEXT,
    "secretVersion" TEXT,
    "serviceType" TEXT NOT NULL DEFAULT 'text',
    "customEndpoint" TEXT,
    "customModel" TEXT,
    "connectionStatus" TEXT DEFAULT 'unknown',
    "lastTestedAt" TIMESTAMP(3),
    "responseTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValue" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeechUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "audioDuration" DOUBLE PRECISION,
    "audioSize" INTEGER,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "transcriptText" TEXT,
    "confidence" DOUBLE PRECISION,
    "context" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "costTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeechUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentpitIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "rawProfile" JSONB,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentpitIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "modelName" TEXT,
    "requestId" TEXT,
    "requestPath" TEXT,
    "responseTimeMs" INTEGER,
    "responseStatus" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfileState" (
    "id" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "summary" JSONB NOT NULL,
    "snapshotV1" JSONB,
    "lastAssessmentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfileState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfileVersion" (
    "id" TEXT NOT NULL,
    "agentProfileStateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "snapshotV1" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberProfileId" TEXT,
    "agentSessionId" TEXT,
    "accountType" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
    "plan" JSONB NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecutionStep" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "toolId" TEXT NOT NULL,
    "summary" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentExecutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorBotConfig" (
    "id" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "assistantName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "welcomeMessage" TEXT,
    "publicSlug" TEXT NOT NULL,
    "fastgptBaseUrl" TEXT NOT NULL,
    "fastgptApiKeyEncrypted" TEXT,
    "enabledScaleIds" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastValidatedAt" TIMESTAMP(3),
    "validationStatus" TEXT,
    "lastValidationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorBotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorBotChatSession" (
    "id" TEXT NOT NULL,
    "doctorBotId" TEXT NOT NULL,
    "visitorSessionId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "memberProfileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorBotChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorNeonateArchive" (
    "id" TEXT NOT NULL,
    "doctorProfileId" TEXT NOT NULL,
    "babyName" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "birthGestationWeeks" INTEGER NOT NULL,
    "birthGestationDays" INTEGER NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthTimeMinutes" INTEGER,
    "normalizedMatchKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorNeonateArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorNeonateGrowthRecord" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "recordTimeMinutes" INTEGER,
    "length" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "headCircumference" DOUBLE PRECISION,
    "bilirubinUmol" DOUBLE PRECISION,
    "bilirubinContext" "DoctorNeonateBilirubinContext",
    "currentGestationWeeks" INTEGER NOT NULL,
    "currentGestationDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorNeonateGrowthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceId_key" ON "User"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_accountType_idx" ON "User"("accountType");

-- CreateIndex
CREATE INDEX "AuthVerificationCode_phone_purpose_createdAt_idx" ON "AuthVerificationCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AuthVerificationCode_expiresAt_idx" ON "AuthVerificationCode"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthVerificationCode_consumedAt_idx" ON "AuthVerificationCode"("consumedAt");

-- CreateIndex
CREATE INDEX "ChildProfile_userId_relation_idx" ON "ChildProfile"("userId", "relation");

-- CreateIndex
CREATE INDEX "ChildProfile_contactPhone_idx" ON "ChildProfile"("contactPhone");

-- CreateIndex
CREATE INDEX "ChildProfile_realName_gender_idx" ON "ChildProfile"("realName", "gender");

-- CreateIndex
CREATE INDEX "ChildProfile_pendingClaim_idx" ON "ChildProfile"("pendingClaim");

-- CreateIndex
CREATE INDEX "AiToyDeviceBinding_userId_memberProfileId_idx" ON "AiToyDeviceBinding"("userId", "memberProfileId");

-- CreateIndex
CREATE INDEX "AiToyDeviceBinding_status_updatedAt_idx" ON "AiToyDeviceBinding"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiToyDeviceBinding_deviceId_key" ON "AiToyDeviceBinding"("deviceId");

-- CreateIndex
CREATE INDEX "AssessmentHistory_userId_createdAt_idx" ON "AssessmentHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentHistory_profileId_createdAt_idx" ON "AssessmentHistory"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentHistory_scaleId_scaleVersion_idx" ON "AssessmentHistory"("scaleId", "scaleVersion");

-- CreateIndex
CREATE INDEX "AssessmentHistory_inviteId_idx" ON "AssessmentHistory"("inviteId");

-- CreateIndex
CREATE INDEX "AssessmentHistory_respondentPhone_createdAt_idx" ON "AssessmentHistory"("respondentPhone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSession_publicToken_key" ON "AssessmentSession"("publicToken");

-- CreateIndex
CREATE INDEX "AssessmentSession_userId_status_updatedAt_idx" ON "AssessmentSession"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "AssessmentSession_profileId_status_updatedAt_idx" ON "AssessmentSession"("profileId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "AssessmentSession_scaleId_scaleVersion_idx" ON "AssessmentSession"("scaleId", "scaleVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCallbackDelivery_assessmentSessionId_key" ON "AssessmentCallbackDelivery"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "AssessmentCallbackDelivery_status_updatedAt_idx" ON "AssessmentCallbackDelivery"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_orgCode_key" ON "Organization"("orgCode");

-- CreateIndex
CREATE INDEX "Organization_status_createdAt_idx" ON "Organization"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_licenseNo_key" ON "DoctorProfile"("licenseNo");

-- CreateIndex
CREATE INDEX "DoctorProfile_verificationStatus_idx" ON "DoctorProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "DoctorProfile_realName_idx" ON "DoctorProfile"("realName");

-- CreateIndex
CREATE INDEX "DoctorProfile_hospitalName_departmentName_idx" ON "DoctorProfile"("hospitalName", "departmentName");

-- CreateIndex
CREATE INDEX "DoctorProfile_organizationId_idx" ON "DoctorProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HermesProfile_organizationId_key" ON "HermesProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HermesProfile_doctorProfileId_key" ON "HermesProfile"("doctorProfileId");

-- CreateIndex
CREATE INDEX "HermesProfile_ownerType_status_idx" ON "HermesProfile"("ownerType", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_scopeType_status_language_createdAt_idx" ON "KnowledgeDoc"("scopeType", "status", "language", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_organizationId_doctorProfileId_status_idx" ON "KnowledgeDoc"("organizationId", "doctorProfileId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_docId_createdAt_idx" ON "KnowledgeChunk"("docId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_docId_chunkIndex_key" ON "KnowledgeChunk"("docId", "chunkIndex");

-- CreateIndex
CREATE INDEX "QuestionExplanation_scaleId_questionId_lang_scopeType_statu_idx" ON "QuestionExplanation"("scaleId", "questionId", "lang", "scopeType", "status", "priority");

-- CreateIndex
CREATE INDEX "QuestionExplanation_organizationId_doctorProfileId_status_idx" ON "QuestionExplanation"("organizationId", "doctorProfileId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_memberProfileId_createdAt_idx" ON "AuditLog"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorScaleInvite_token_key" ON "DoctorScaleInvite"("token");

-- CreateIndex
CREATE INDEX "DoctorScaleInvite_doctorProfileId_status_createdAt_idx" ON "DoctorScaleInvite"("doctorProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorScaleInvite_expiresAt_idx" ON "DoctorScaleInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "DoctorScaleInvite_linkedMemberId_idx" ON "DoctorScaleInvite"("linkedMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicScreeningPoint_code_key" ON "ClinicScreeningPoint"("code");

-- CreateIndex
CREATE INDEX "ClinicScreeningPoint_ownerDoctorProfileId_isActive_idx" ON "ClinicScreeningPoint"("ownerDoctorProfileId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicScaleQr_slug_key" ON "ClinicScaleQr"("slug");

-- CreateIndex
CREATE INDEX "ClinicScaleQr_pointId_isActive_idx" ON "ClinicScaleQr"("pointId", "isActive");

-- CreateIndex
CREATE INDEX "ClinicScaleQr_scaleId_isActive_idx" ON "ClinicScaleQr"("scaleId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicScreeningSubmission_screeningCode_key" ON "ClinicScreeningSubmission"("screeningCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicScreeningSubmission_assessmentHistoryId_key" ON "ClinicScreeningSubmission"("assessmentHistoryId");

-- CreateIndex
CREATE INDEX "ClinicScreeningSubmission_doctorProfileId_createdAt_idx" ON "ClinicScreeningSubmission"("doctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicScreeningSubmission_pointId_createdAt_idx" ON "ClinicScreeningSubmission"("pointId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicScreeningSubmission_clinicScaleQrId_createdAt_idx" ON "ClinicScreeningSubmission"("clinicScaleQrId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicScreeningSubmission_status_createdAt_idx" ON "ClinicScreeningSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicScreeningSubmission_guestSessionId_idx" ON "ClinicScreeningSubmission"("guestSessionId");

-- CreateIndex
CREATE INDEX "CareAssignment_memberProfileId_status_idx" ON "CareAssignment"("memberProfileId", "status");

-- CreateIndex
CREATE INDEX "CareAssignment_doctorProfileId_status_idx" ON "CareAssignment"("doctorProfileId", "status");

-- CreateIndex
CREATE INDEX "CareTeam_hospitalName_departmentName_isActive_idx" ON "CareTeam"("hospitalName", "departmentName", "isActive");

-- CreateIndex
CREATE INDEX "CareTeam_createdByAdminId_createdAt_idx" ON "CareTeam"("createdByAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "CareTeamMembership_doctorProfileId_updatedAt_idx" ON "CareTeamMembership"("doctorProfileId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareTeamMembership_teamId_doctorProfileId_key" ON "CareTeamMembership"("teamId", "doctorProfileId");

-- CreateIndex
CREATE INDEX "MemberCareAccessGrant_memberProfileId_revokedAt_idx" ON "MemberCareAccessGrant"("memberProfileId", "revokedAt");

-- CreateIndex
CREATE INDEX "MemberCareAccessGrant_doctorProfileId_revokedAt_idx" ON "MemberCareAccessGrant"("doctorProfileId", "revokedAt");

-- CreateIndex
CREATE INDEX "MemberCareAccessGrant_sourceTeamId_revokedAt_idx" ON "MemberCareAccessGrant"("sourceTeamId", "revokedAt");

-- CreateIndex
CREATE INDEX "NeonateArchiveAccessGrant_archiveId_revokedAt_idx" ON "NeonateArchiveAccessGrant"("archiveId", "revokedAt");

-- CreateIndex
CREATE INDEX "NeonateArchiveAccessGrant_doctorProfileId_revokedAt_idx" ON "NeonateArchiveAccessGrant"("doctorProfileId", "revokedAt");

-- CreateIndex
CREATE INDEX "NeonateArchiveAccessGrant_sourceTeamId_revokedAt_idx" ON "NeonateArchiveAccessGrant"("sourceTeamId", "revokedAt");

-- CreateIndex
CREATE INDEX "DoctorCollaborationAuditLog_resourceType_resourceId_created_idx" ON "DoctorCollaborationAuditLog"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorCollaborationAuditLog_actorDoctorProfileId_createdAt_idx" ON "DoctorCollaborationAuditLog"("actorDoctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorCollaborationAuditLog_sourceTeamId_createdAt_idx" ON "DoctorCollaborationAuditLog"("sourceTeamId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorPatientNote_memberProfileId_createdAt_idx" ON "DoctorPatientNote"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorPatientNote_doctorProfileId_createdAt_idx" ON "DoctorPatientNote"("doctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorPatientNote_assessmentHistoryId_idx" ON "DoctorPatientNote"("assessmentHistoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchConsent_memberProfileId_key" ON "ResearchConsent"("memberProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchExportLog_exportBatchKey_key" ON "ResearchExportLog"("exportBatchKey");

-- CreateIndex
CREATE INDEX "ResearchExportLog_memberProfileId_createdAt_idx" ON "ResearchExportLog"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchExportLog_doctorProfileId_createdAt_idx" ON "ResearchExportLog"("doctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchExportLog_requestedByUserId_createdAt_idx" ON "ResearchExportLog"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchExportLog_requestedByAdminId_createdAt_idx" ON "ResearchExportLog"("requestedByAdminId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "child_baseline_memberProfileId_key" ON "child_baseline"("memberProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "child_baseline_researchSubjectId_key" ON "child_baseline"("researchSubjectId");

-- CreateIndex
CREATE INDEX "child_baseline_researchSubjectId_idx" ON "child_baseline"("researchSubjectId");

-- CreateIndex
CREATE INDEX "child_baseline_sex_birthYear_idx" ON "child_baseline"("sex", "birthYear");

-- CreateIndex
CREATE INDEX "scale_score_memberProfileId_scaleId_idx" ON "scale_score"("memberProfileId", "scaleId");

-- CreateIndex
CREATE INDEX "scale_score_assessmentHistoryId_idx" ON "scale_score"("assessmentHistoryId");

-- CreateIndex
CREATE INDEX "scale_score_assessmentSessionId_idx" ON "scale_score"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "scale_score_scaleId_questionId_idx" ON "scale_score"("scaleId", "questionId");

-- CreateIndex
CREATE INDEX "followup_memberProfileId_status_createdAt_idx" ON "followup"("memberProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "followup_assessmentSessionId_idx" ON "followup"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "followup_assessmentHistoryId_idx" ON "followup"("assessmentHistoryId");

-- CreateIndex
CREATE INDEX "followup_doctorProfileId_createdAt_idx" ON "followup"("doctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_interaction_userId_createdAt_idx" ON "ai_interaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_interaction_memberProfileId_createdAt_idx" ON "ai_interaction"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_interaction_assessmentSessionId_createdAt_idx" ON "ai_interaction"("assessmentSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_interaction_scaleId_questionId_createdAt_idx" ON "ai_interaction"("scaleId", "questionId", "createdAt");

-- CreateIndex
CREATE INDEX "report_view_userId_viewedAt_idx" ON "report_view"("userId", "viewedAt");

-- CreateIndex
CREATE INDEX "report_view_memberProfileId_viewedAt_idx" ON "report_view"("memberProfileId", "viewedAt");

-- CreateIndex
CREATE INDEX "report_view_assessmentSessionId_viewedAt_idx" ON "report_view"("assessmentSessionId", "viewedAt");

-- CreateIndex
CREATE INDEX "report_view_doctorProfileId_viewedAt_idx" ON "report_view"("doctorProfileId", "viewedAt");

-- CreateIndex
CREATE INDEX "outcome_3m_memberProfileId_measuredAt_idx" ON "outcome_3m"("memberProfileId", "measuredAt");

-- CreateIndex
CREATE INDEX "outcome_3m_assessmentSessionId_idx" ON "outcome_3m"("assessmentSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "inpatient_record_admissionId_key" ON "inpatient_record"("admissionId");

-- CreateIndex
CREATE INDEX "inpatient_record_memberProfileId_admissionDate_idx" ON "inpatient_record"("memberProfileId", "admissionDate");

-- CreateIndex
CREATE INDEX "inpatient_record_doctorProfileId_admissionDate_idx" ON "inpatient_record"("doctorProfileId", "admissionDate");

-- CreateIndex
CREATE INDEX "scale_license_metadata_licenseStatus_idx" ON "scale_license_metadata"("licenseStatus");

-- CreateIndex
CREATE INDEX "scale_license_metadata_commercialEnabled_idx" ON "scale_license_metadata"("commercialEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "scale_license_metadata_scaleId_scaleVersion_key" ON "scale_license_metadata"("scaleId", "scaleVersion");

-- CreateIndex
CREATE INDEX "doctor_review_status_createdAt_idx" ON "doctor_review"("status", "createdAt");

-- CreateIndex
CREATE INDEX "doctor_review_doctorProfileId_status_createdAt_idx" ON "doctor_review"("doctorProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "doctor_review_memberProfileId_createdAt_idx" ON "doctor_review"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "doctor_review_assessmentHistoryId_idx" ON "doctor_review"("assessmentHistoryId");

-- CreateIndex
CREATE INDEX "doctor_review_assessmentSessionId_idx" ON "doctor_review"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "report_template_status_isDefault_idx" ON "report_template"("status", "isDefault");

-- CreateIndex
CREATE INDEX "report_template_createdByDoctorProfileId_idx" ON "report_template"("createdByDoctorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_report_reportNo_key" ON "assessment_report"("reportNo");

-- CreateIndex
CREATE INDEX "assessment_report_memberProfileId_createdAt_idx" ON "assessment_report"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "assessment_report_doctorReviewId_idx" ON "assessment_report"("doctorReviewId");

-- CreateIndex
CREATE INDEX "assessment_report_templateId_idx" ON "assessment_report"("templateId");

-- CreateIndex
CREATE INDEX "assessment_report_reportStatus_createdAt_idx" ON "assessment_report"("reportStatus", "createdAt");

-- CreateIndex
CREATE INDEX "assessment_report_approvedByDoctorProfileId_approvedAt_idx" ON "assessment_report"("approvedByDoctorProfileId", "approvedAt");

-- CreateIndex
CREATE INDEX "education_content_status_scaleId_idx" ON "education_content"("status", "scaleId");

-- CreateIndex
CREATE INDEX "education_content_sourceDocId_idx" ON "education_content"("sourceDocId");

-- CreateIndex
CREATE INDEX "education_content_createdByDoctorProfileId_idx" ON "education_content"("createdByDoctorProfileId");

-- CreateIndex
CREATE INDEX "education_content_reviewedByAdminId_reviewedAt_idx" ON "education_content"("reviewedByAdminId", "reviewedAt");

-- CreateIndex
CREATE INDEX "education_delivery_memberProfileId_deliveryStatus_createdAt_idx" ON "education_delivery"("memberProfileId", "deliveryStatus", "createdAt");

-- CreateIndex
CREATE INDEX "education_delivery_educationContentId_createdAt_idx" ON "education_delivery"("educationContentId", "createdAt");

-- CreateIndex
CREATE INDEX "education_delivery_assessmentReportId_idx" ON "education_delivery"("assessmentReportId");

-- CreateIndex
CREATE INDEX "education_delivery_doctorProfileId_createdAt_idx" ON "education_delivery"("doctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "followup_task_memberProfileId_status_dueDate_idx" ON "followup_task"("memberProfileId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "followup_task_taskType_dueDate_idx" ON "followup_task"("taskType", "dueDate");

-- CreateIndex
CREATE INDEX "followup_task_baselineAssessmentHistoryId_idx" ON "followup_task"("baselineAssessmentHistoryId");

-- CreateIndex
CREATE INDEX "followup_task_completedAssessmentHistoryId_idx" ON "followup_task"("completedAssessmentHistoryId");

-- CreateIndex
CREATE INDEX "followup_task_createdByDoctorProfileId_idx" ON "followup_task"("createdByDoctorProfileId");

-- CreateIndex
CREATE INDEX "reminder_log_followUpTaskId_recordedAt_idx" ON "reminder_log"("followUpTaskId", "recordedAt");

-- CreateIndex
CREATE INDEX "reminder_log_memberProfileId_recordedAt_idx" ON "reminder_log"("memberProfileId", "recordedAt");

-- CreateIndex
CREATE INDEX "reminder_log_doctorProfileId_recordedAt_idx" ON "reminder_log"("doctorProfileId", "recordedAt");

-- CreateIndex
CREATE INDEX "research_import_batch_status_createdAt_idx" ON "research_import_batch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "research_import_batch_uploadedByDoctorProfileId_createdAt_idx" ON "research_import_batch"("uploadedByDoctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "research_import_batch_requestedByUserId_createdAt_idx" ON "research_import_batch"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "research_import_row_researchSubjectId_idx" ON "research_import_row"("researchSubjectId");

-- CreateIndex
CREATE INDEX "research_import_row_sourceRowHash_idx" ON "research_import_row"("sourceRowHash");

-- CreateIndex
CREATE UNIQUE INDEX "research_import_row_batchId_rowNumber_key" ON "research_import_row"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "research_field_mapping_canonicalField_idx" ON "research_field_mapping"("canonicalField");

-- CreateIndex
CREATE UNIQUE INDEX "research_field_mapping_batchId_sourceField_key" ON "research_field_mapping"("batchId", "sourceField");

-- CreateIndex
CREATE UNIQUE INDEX "research_derived_dataset_exportLogId_key" ON "research_derived_dataset"("exportLogId");

-- CreateIndex
CREATE INDEX "research_derived_dataset_datasetVersion_createdAt_idx" ON "research_derived_dataset"("datasetVersion", "createdAt");

-- CreateIndex
CREATE INDEX "research_derived_dataset_contentHash_idx" ON "research_derived_dataset"("contentHash");

-- CreateIndex
CREATE INDEX "ai_decision_log_decisionType_createdAt_idx" ON "ai_decision_log"("decisionType", "createdAt");

-- CreateIndex
CREATE INDEX "ai_decision_log_memberProfileId_createdAt_idx" ON "ai_decision_log"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_decision_log_assessmentSessionId_createdAt_idx" ON "ai_decision_log"("assessmentSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_decision_log_doctorProfileId_createdAt_idx" ON "ai_decision_log"("doctorProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_tool_log_toolName_createdAt_idx" ON "mcp_tool_log"("toolName", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_tool_log_apiKeyId_createdAt_idx" ON "mcp_tool_log"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_tool_log_assessmentSessionId_createdAt_idx" ON "mcp_tool_log"("assessmentSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_tool_log_status_createdAt_idx" ON "mcp_tool_log"("status", "createdAt");

-- CreateIndex
CREATE INDEX "McpLog_entrypoint_createdAt_idx" ON "McpLog"("entrypoint", "createdAt");

-- CreateIndex
CREATE INDEX "GrowthRecord_profileId_ageMonths_idx" ON "GrowthRecord"("profileId", "ageMonths");

-- CreateIndex
CREATE INDEX "GrowthRecord_profileId_gestationalWeek_idx" ON "GrowthRecord"("profileId", "gestationalWeek");

-- CreateIndex
CREATE INDEX "TriageSession_userId_status_idx" ON "TriageSession"("userId", "status");

-- CreateIndex
CREATE INDEX "TriageSession_updatedAt_idx" ON "TriageSession"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "ApiKey_purpose_isActive_idx" ON "ApiKey"("purpose", "isActive");

-- CreateIndex
CREATE INDEX "ApiKey_provider_isActive_idx" ON "ApiKey"("provider", "isActive");

-- CreateIndex
CREATE INDEX "ApiKey_serviceType_isActive_idx" ON "ApiKey"("serviceType", "isActive");

-- CreateIndex
CREATE INDEX "ApiKey_secretHash_idx" ON "ApiKey"("secretHash");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_configKey_key" ON "SystemConfig"("configKey");

-- CreateIndex
CREATE INDEX "SpeechUsage_userId_createdAt_idx" ON "SpeechUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeechUsage_provider_createdAt_idx" ON "SpeechUsage"("provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentpitIdentity_providerUserId_key" ON "AgentpitIdentity"("providerUserId");

-- CreateIndex
CREATE INDEX "AgentpitIdentity_userId_idx" ON "AgentpitIdentity"("userId");

-- CreateIndex
CREATE INDEX "AgentpitIdentity_email_idx" ON "AgentpitIdentity"("email");

-- CreateIndex
CREATE INDEX "TokenUsage_userId_createdAt_idx" ON "TokenUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenUsage_clientId_createdAt_idx" ON "TokenUsage"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenUsage_agentId_createdAt_idx" ON "TokenUsage"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenUsage_requestId_idx" ON "TokenUsage"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfileState_memberProfileId_key" ON "AgentProfileState"("memberProfileId");

-- CreateIndex
CREATE INDEX "AgentProfileState_updatedAt_idx" ON "AgentProfileState"("updatedAt");

-- CreateIndex
CREATE INDEX "AgentProfileVersion_agentProfileStateId_version_idx" ON "AgentProfileVersion"("agentProfileStateId", "version");

-- CreateIndex
CREATE INDEX "AgentProfileVersion_createdAt_idx" ON "AgentProfileVersion"("createdAt");

-- CreateIndex
CREATE INDEX "AgentExecution_userId_createdAt_idx" ON "AgentExecution"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentExecution_memberProfileId_createdAt_idx" ON "AgentExecution"("memberProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentExecution_status_createdAt_idx" ON "AgentExecution"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentExecutionStep_executionId_stepOrder_idx" ON "AgentExecutionStep"("executionId", "stepOrder");

-- CreateIndex
CREATE INDEX "AgentExecutionStep_status_createdAt_idx" ON "AgentExecutionStep"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorBotConfig_doctorProfileId_key" ON "DoctorBotConfig"("doctorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorBotConfig_publicSlug_key" ON "DoctorBotConfig"("publicSlug");

-- CreateIndex
CREATE INDEX "DoctorBotConfig_status_updatedAt_idx" ON "DoctorBotConfig"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorBotChatSession_chatId_key" ON "DoctorBotChatSession"("chatId");

-- CreateIndex
CREATE INDEX "DoctorBotChatSession_status_lastActiveAt_idx" ON "DoctorBotChatSession"("status", "lastActiveAt");

-- CreateIndex
CREATE INDEX "DoctorBotChatSession_memberProfileId_lastActiveAt_idx" ON "DoctorBotChatSession"("memberProfileId", "lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorBotChatSession_doctorBotId_visitorSessionId_key" ON "DoctorBotChatSession"("doctorBotId", "visitorSessionId");

-- CreateIndex
CREATE INDEX "DoctorNeonateArchive_doctorProfileId_updatedAt_idx" ON "DoctorNeonateArchive"("doctorProfileId", "updatedAt");

-- CreateIndex
CREATE INDEX "DoctorNeonateArchive_doctorProfileId_normalizedMatchKey_idx" ON "DoctorNeonateArchive"("doctorProfileId", "normalizedMatchKey");

-- CreateIndex
CREATE INDEX "DoctorNeonateArchive_doctorProfileId_babyName_idx" ON "DoctorNeonateArchive"("doctorProfileId", "babyName");

-- CreateIndex
CREATE INDEX "DoctorNeonateGrowthRecord_archiveId_recordDate_recordTimeMi_idx" ON "DoctorNeonateGrowthRecord"("archiveId", "recordDate", "recordTimeMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorNeonateGrowthRecord_archiveId_recordDate_recordTimeMi_key" ON "DoctorNeonateGrowthRecord"("archiveId", "recordDate", "recordTimeMinutes");

-- AddForeignKey
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToyDeviceBinding" ADD CONSTRAINT "AiToyDeviceBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToyDeviceBinding" ADD CONSTRAINT "AiToyDeviceBinding_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHistory" ADD CONSTRAINT "AssessmentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHistory" ADD CONSTRAINT "AssessmentHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHistory" ADD CONSTRAINT "AssessmentHistory_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "DoctorScaleInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCallbackDelivery" ADD CONSTRAINT "AssessmentCallbackDelivery_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HermesProfile" ADD CONSTRAINT "HermesProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HermesProfile" ADD CONSTRAINT "HermesProfile_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDoc" ADD CONSTRAINT "KnowledgeDoc_hermesProfileId_fkey" FOREIGN KEY ("hermesProfileId") REFERENCES "HermesProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_docId_fkey" FOREIGN KEY ("docId") REFERENCES "KnowledgeDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionExplanation" ADD CONSTRAINT "QuestionExplanation_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "KnowledgeDoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorScaleInvite" ADD CONSTRAINT "DoctorScaleInvite_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorScaleInvite" ADD CONSTRAINT "DoctorScaleInvite_linkedMemberId_fkey" FOREIGN KEY ("linkedMemberId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScreeningPoint" ADD CONSTRAINT "ClinicScreeningPoint_ownerDoctorProfileId_fkey" FOREIGN KEY ("ownerDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScaleQr" ADD CONSTRAINT "ClinicScaleQr_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "ClinicScreeningPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScreeningSubmission" ADD CONSTRAINT "ClinicScreeningSubmission_clinicScaleQrId_fkey" FOREIGN KEY ("clinicScaleQrId") REFERENCES "ClinicScaleQr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScreeningSubmission" ADD CONSTRAINT "ClinicScreeningSubmission_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "ClinicScreeningPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScreeningSubmission" ADD CONSTRAINT "ClinicScreeningSubmission_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScreeningSubmission" ADD CONSTRAINT "ClinicScreeningSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScreeningSubmission" ADD CONSTRAINT "ClinicScreeningSubmission_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicScreeningSubmission" ADD CONSTRAINT "ClinicScreeningSubmission_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAssignment" ADD CONSTRAINT "CareAssignment_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAssignment" ADD CONSTRAINT "CareAssignment_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAssignment" ADD CONSTRAINT "CareAssignment_assignedByPatientUserId_fkey" FOREIGN KEY ("assignedByPatientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTeam" ADD CONSTRAINT "CareTeam_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTeamMembership" ADD CONSTRAINT "CareTeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CareTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTeamMembership" ADD CONSTRAINT "CareTeamMembership_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCareAccessGrant" ADD CONSTRAINT "MemberCareAccessGrant_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCareAccessGrant" ADD CONSTRAINT "MemberCareAccessGrant_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCareAccessGrant" ADD CONSTRAINT "MemberCareAccessGrant_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES "CareTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCareAccessGrant" ADD CONSTRAINT "MemberCareAccessGrant_grantedByDoctorProfileId_fkey" FOREIGN KEY ("grantedByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonateArchiveAccessGrant" ADD CONSTRAINT "NeonateArchiveAccessGrant_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "DoctorNeonateArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonateArchiveAccessGrant" ADD CONSTRAINT "NeonateArchiveAccessGrant_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonateArchiveAccessGrant" ADD CONSTRAINT "NeonateArchiveAccessGrant_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES "CareTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonateArchiveAccessGrant" ADD CONSTRAINT "NeonateArchiveAccessGrant_grantedByDoctorProfileId_fkey" FOREIGN KEY ("grantedByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorCollaborationAuditLog" ADD CONSTRAINT "DoctorCollaborationAuditLog_actorDoctorProfileId_fkey" FOREIGN KEY ("actorDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorCollaborationAuditLog" ADD CONSTRAINT "DoctorCollaborationAuditLog_targetDoctorProfileId_fkey" FOREIGN KEY ("targetDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorCollaborationAuditLog" ADD CONSTRAINT "DoctorCollaborationAuditLog_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES "CareTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPatientNote" ADD CONSTRAINT "DoctorPatientNote_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPatientNote" ADD CONSTRAINT "DoctorPatientNote_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPatientNote" ADD CONSTRAINT "DoctorPatientNote_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchConsent" ADD CONSTRAINT "ResearchConsent_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchConsent" ADD CONSTRAINT "ResearchConsent_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_requestedByAdminId_fkey" FOREIGN KEY ("requestedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_baseline" ADD CONSTRAINT "child_baseline_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_score" ADD CONSTRAINT "scale_score_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_score" ADD CONSTRAINT "scale_score_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_score" ADD CONSTRAINT "scale_score_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup" ADD CONSTRAINT "followup_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup" ADD CONSTRAINT "followup_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup" ADD CONSTRAINT "followup_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup" ADD CONSTRAINT "followup_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_view" ADD CONSTRAINT "report_view_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_3m" ADD CONSTRAINT "outcome_3m_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_3m" ADD CONSTRAINT "outcome_3m_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpatient_record" ADD CONSTRAINT "inpatient_record_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpatient_record" ADD CONSTRAINT "inpatient_record_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_review" ADD CONSTRAINT "doctor_review_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_template" ADD CONSTRAINT "report_template_createdByDoctorProfileId_fkey" FOREIGN KEY ("createdByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_doctorReviewId_fkey" FOREIGN KEY ("doctorReviewId") REFERENCES "doctor_review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "report_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_approvedByDoctorProfileId_fkey" FOREIGN KEY ("approvedByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_content" ADD CONSTRAINT "education_content_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "KnowledgeDoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_content" ADD CONSTRAINT "education_content_createdByDoctorProfileId_fkey" FOREIGN KEY ("createdByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_educationContentId_fkey" FOREIGN KEY ("educationContentId") REFERENCES "education_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_assessmentReportId_fkey" FOREIGN KEY ("assessmentReportId") REFERENCES "assessment_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_delivery" ADD CONSTRAINT "education_delivery_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_baselineAssessmentHistoryId_fkey" FOREIGN KEY ("baselineAssessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_baselineAssessmentSessionId_fkey" FOREIGN KEY ("baselineAssessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_completedAssessmentHistoryId_fkey" FOREIGN KEY ("completedAssessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_completedAssessmentSessionId_fkey" FOREIGN KEY ("completedAssessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_task" ADD CONSTRAINT "followup_task_createdByDoctorProfileId_fkey" FOREIGN KEY ("createdByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_followUpTaskId_fkey" FOREIGN KEY ("followUpTaskId") REFERENCES "followup_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_import_batch" ADD CONSTRAINT "research_import_batch_uploadedByDoctorProfileId_fkey" FOREIGN KEY ("uploadedByDoctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_import_batch" ADD CONSTRAINT "research_import_batch_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_import_row" ADD CONSTRAINT "research_import_row_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "research_import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_field_mapping" ADD CONSTRAINT "research_field_mapping_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "research_import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_derived_dataset" ADD CONSTRAINT "research_derived_dataset_exportLogId_fkey" FOREIGN KEY ("exportLogId") REFERENCES "ResearchExportLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tool_log" ADD CONSTRAINT "mcp_tool_log_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpLog" ADD CONSTRAINT "McpLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthRecord" ADD CONSTRAINT "GrowthRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageSession" ADD CONSTRAINT "TriageSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeechUsage" ADD CONSTRAINT "SpeechUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentpitIdentity" ADD CONSTRAINT "AgentpitIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfileState" ADD CONSTRAINT "AgentProfileState_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfileVersion" ADD CONSTRAINT "AgentProfileVersion_agentProfileStateId_fkey" FOREIGN KEY ("agentProfileStateId") REFERENCES "AgentProfileState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecutionStep" ADD CONSTRAINT "AgentExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorBotConfig" ADD CONSTRAINT "DoctorBotConfig_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorBotChatSession" ADD CONSTRAINT "DoctorBotChatSession_doctorBotId_fkey" FOREIGN KEY ("doctorBotId") REFERENCES "DoctorBotConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorBotChatSession" ADD CONSTRAINT "DoctorBotChatSession_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNeonateArchive" ADD CONSTRAINT "DoctorNeonateArchive_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNeonateGrowthRecord" ADD CONSTRAINT "DoctorNeonateGrowthRecord_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "DoctorNeonateArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
