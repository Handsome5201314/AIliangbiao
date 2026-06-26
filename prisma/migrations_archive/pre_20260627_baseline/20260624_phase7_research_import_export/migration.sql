ALTER TABLE IF EXISTS "ResearchExportLog" DROP CONSTRAINT IF EXISTS "ResearchExportLog_memberProfileId_fkey";
ALTER TABLE IF EXISTS "ResearchExportLog" DROP CONSTRAINT IF EXISTS "ResearchExportLog_doctorProfileId_fkey";
ALTER TABLE IF EXISTS "ResearchExportLog" DROP CONSTRAINT IF EXISTS "ResearchExportLog_requestedByUserId_fkey";

ALTER TABLE IF EXISTS "ResearchExportLog" ALTER COLUMN "memberProfileId" DROP NOT NULL;
ALTER TABLE IF EXISTS "ResearchExportLog" ALTER COLUMN "doctorProfileId" DROP NOT NULL;
ALTER TABLE IF EXISTS "ResearchExportLog" ALTER COLUMN "requestedByUserId" DROP NOT NULL;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "requestedByAdminId" TEXT;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "actorType" TEXT NOT NULL DEFAULT 'DOCTOR';
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "exportBatchKey" TEXT;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "datasetVersion" TEXT NOT NULL DEFAULT 'research-derived-v1';
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "fieldSetVersion" TEXT NOT NULL DEFAULT '2026.06.phase7';
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "recordCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "tables" JSONB;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD COLUMN IF NOT EXISTS "qualitySummary" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "ResearchExportLog_exportBatchKey_key" ON "ResearchExportLog"("exportBatchKey");
CREATE INDEX IF NOT EXISTS "ResearchExportLog_requestedByUserId_createdAt_idx" ON "ResearchExportLog"("requestedByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "ResearchExportLog_requestedByAdminId_createdAt_idx" ON "ResearchExportLog"("requestedByAdminId", "createdAt");

ALTER TABLE IF EXISTS "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "ResearchExportLog" ADD CONSTRAINT "ResearchExportLog_requestedByAdminId_fkey" FOREIGN KEY ("requestedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "research_import_row" (
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

CREATE TABLE IF NOT EXISTS "research_field_mapping" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceField" TEXT NOT NULL,
  "canonicalField" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "research_field_mapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "research_derived_dataset" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "research_import_row_batchId_rowNumber_key" ON "research_import_row"("batchId", "rowNumber");
CREATE INDEX IF NOT EXISTS "research_import_row_researchSubjectId_idx" ON "research_import_row"("researchSubjectId");
CREATE INDEX IF NOT EXISTS "research_import_row_sourceRowHash_idx" ON "research_import_row"("sourceRowHash");
CREATE UNIQUE INDEX IF NOT EXISTS "research_field_mapping_batchId_sourceField_key" ON "research_field_mapping"("batchId", "sourceField");
CREATE INDEX IF NOT EXISTS "research_field_mapping_canonicalField_idx" ON "research_field_mapping"("canonicalField");
CREATE UNIQUE INDEX IF NOT EXISTS "research_derived_dataset_exportLogId_key" ON "research_derived_dataset"("exportLogId");
CREATE INDEX IF NOT EXISTS "research_derived_dataset_datasetVersion_createdAt_idx" ON "research_derived_dataset"("datasetVersion", "createdAt");
CREATE INDEX IF NOT EXISTS "research_derived_dataset_contentHash_idx" ON "research_derived_dataset"("contentHash");

ALTER TABLE "research_import_row" ADD CONSTRAINT "research_import_row_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "research_import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_field_mapping" ADD CONSTRAINT "research_field_mapping_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "research_import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_derived_dataset" ADD CONSTRAINT "research_derived_dataset_exportLogId_fkey" FOREIGN KEY ("exportLogId") REFERENCES "ResearchExportLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
