-- Remove the embedded Hermes runtime layer, neonatal ward, and growth-record surfaces.
-- Production deploys must back up the database before running this migration.

ALTER TABLE "KnowledgeDoc" DROP CONSTRAINT IF EXISTS "KnowledgeDoc_hermesProfileId_fkey";
ALTER TABLE "KnowledgeDoc" DROP COLUMN IF EXISTS "hermesProfileId";

DROP TABLE IF EXISTS "NeonateArchiveAccessGrant";
DROP TABLE IF EXISTS "DoctorNeonateGrowthRecord";
DROP TABLE IF EXISTS "DoctorNeonateArchive";
DROP TABLE IF EXISTS "GrowthRecord";
DROP TABLE IF EXISTS "HermesProfile";

DROP INDEX IF EXISTS "aics_hermes_idx";
ALTER TABLE "ai_conversation_session" DROP COLUMN IF EXISTS "hermesConversationId";
ALTER TABLE "ai_conversation_event" DROP COLUMN IF EXISTS "hermesConversationId";

DELETE FROM "DoctorCollaborationAuditLog" WHERE "resourceType"::text = 'NEONATE_ARCHIVE';
DELETE FROM "AuditLog" WHERE "targetType"::text = 'HERMES_PROFILE';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'CollaborationResourceType'
      AND e.enumlabel = 'NEONATE_ARCHIVE'
  ) THEN
    ALTER TYPE "CollaborationResourceType" RENAME TO "CollaborationResourceType_old_20260702";
    CREATE TYPE "CollaborationResourceType" AS ENUM ('PATIENT_MEMBER', 'CARE_TEAM');
    ALTER TABLE "DoctorCollaborationAuditLog"
      ALTER COLUMN "resourceType" TYPE "CollaborationResourceType"
      USING "resourceType"::text::"CollaborationResourceType";
    DROP TYPE "CollaborationResourceType_old_20260702";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'AuditTargetType'
      AND e.enumlabel = 'HERMES_PROFILE'
  ) THEN
    ALTER TYPE "AuditTargetType" RENAME TO "AuditTargetType_old_20260702";
    CREATE TYPE "AuditTargetType" AS ENUM (
      'MEMBER_PROFILE',
      'KNOWLEDGE_DOC',
      'QUESTION_EXPLANATION',
      'EDUCATION_CONTENT',
      'EDUCATION_DELIVERY',
      'FOLLOWUP_TASK',
      'REMINDER_LOG',
      'AGENT_SESSION',
      'ORGANIZATION'
    );
    ALTER TABLE "AuditLog"
      ALTER COLUMN "targetType" TYPE "AuditTargetType"
      USING "targetType"::text::"AuditTargetType";
    DROP TYPE "AuditTargetType_old_20260702";
  END IF;
END $$;

DROP TYPE IF EXISTS "DoctorNeonateBilirubinContext";
DROP TYPE IF EXISTS "HermesProfileOwnerType";
DROP TYPE IF EXISTS "HermesProfileStatus";
