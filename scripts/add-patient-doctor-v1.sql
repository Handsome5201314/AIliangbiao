DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('PATIENT', 'DOCTOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DoctorVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CareAssignmentStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DoctorPatientNoteType" AS ENUM ('CLINICAL', 'RESEARCH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ResearchConsentStatus" AS ENUM ('GRANTED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserPrivacyConsentType" AS ENUM ('CLOUD_DATA_PRIVACY_RISK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserPrivacyConsentSource" AS ENUM ('REGISTER', 'GUEST_UPGRADE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "accountType" "AccountType";

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

CREATE TABLE IF NOT EXISTS "DoctorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "realName" TEXT NOT NULL,
  "hospitalName" TEXT NOT NULL,
  "departmentName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "licenseNo" TEXT NOT NULL,
  "verificationStatus" "DoctorVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNotes" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DoctorProfile_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DoctorProfile_userId_key" ON "DoctorProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "DoctorProfile_licenseNo_key" ON "DoctorProfile"("licenseNo");

CREATE TABLE IF NOT EXISTS "CareAssignment" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "doctorProfileId" TEXT NOT NULL,
  "status" "CareAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedByPatientUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CareAssignment_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CareAssignment_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CareAssignment_assignedByPatientUserId_fkey" FOREIGN KEY ("assignedByPatientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DoctorPatientNote" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "doctorProfileId" TEXT NOT NULL,
  "assessmentHistoryId" TEXT,
  "noteType" "DoctorPatientNoteType" NOT NULL DEFAULT 'CLINICAL',
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorPatientNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorPatientNote_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DoctorPatientNote_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DoctorPatientNote_assessmentHistoryId_fkey" FOREIGN KEY ("assessmentHistoryId") REFERENCES "AssessmentHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ResearchConsent" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "status" "ResearchConsentStatus" NOT NULL DEFAULT 'GRANTED',
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResearchConsent_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResearchConsent_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResearchConsent_memberProfileId_key" ON "ResearchConsent"("memberProfileId");

CREATE TABLE IF NOT EXISTS "ResearchExportLog" (
  "id" TEXT NOT NULL,
  "doctorProfileId" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "exportType" TEXT NOT NULL,
  "exportRange" TEXT,
  "purpose" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchExportLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResearchExportLog_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResearchExportLog_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserPrivacyConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "consentType" "UserPrivacyConsentType" NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "source" "UserPrivacyConsentSource" NOT NULL,
  CONSTRAINT "UserPrivacyConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserPrivacyConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DoctorProfile_verificationStatus_createdAt_idx"
ON "DoctorProfile"("verificationStatus", "createdAt");

CREATE INDEX IF NOT EXISTS "CareAssignment_memberProfileId_status_startedAt_idx"
ON "CareAssignment"("memberProfileId", "status", "startedAt");

CREATE INDEX IF NOT EXISTS "CareAssignment_doctorProfileId_status_startedAt_idx"
ON "CareAssignment"("doctorProfileId", "status", "startedAt");

CREATE INDEX IF NOT EXISTS "DoctorPatientNote_memberProfileId_createdAt_idx"
ON "DoctorPatientNote"("memberProfileId", "createdAt");

CREATE INDEX IF NOT EXISTS "DoctorPatientNote_doctorProfileId_createdAt_idx"
ON "DoctorPatientNote"("doctorProfileId", "createdAt");

CREATE INDEX IF NOT EXISTS "ResearchExportLog_doctorProfileId_createdAt_idx"
ON "ResearchExportLog"("doctorProfileId", "createdAt");

CREATE INDEX IF NOT EXISTS "UserPrivacyConsent_userId_consentType_acceptedAt_idx"
ON "UserPrivacyConsent"("userId", "consentType", "acceptedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CareAssignment_one_active_doctor_per_member_idx"
ON "CareAssignment"("memberProfileId")
WHERE "status" = 'ACTIVE';
