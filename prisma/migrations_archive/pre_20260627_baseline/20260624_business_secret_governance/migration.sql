ALTER TABLE "ApiKey" ALTER COLUMN "keyValue" DROP NOT NULL;

ALTER TABLE "ApiKey"
  ADD COLUMN "secretCiphertext" TEXT,
  ADD COLUMN "secretHash" TEXT,
  ADD COLUMN "secretPreview" TEXT,
  ADD COLUMN "secretVersion" TEXT;

CREATE INDEX "ApiKey_secretHash_idx" ON "ApiKey"("secretHash");

ALTER TABLE "DoctorBotConfig" ALTER COLUMN "fastgptApiKeyEncrypted" DROP NOT NULL;
