-- Smart Lab pipeline: extraction trace, validation errors, catalog extensions

ALTER TABLE "LabReport" ADD COLUMN IF NOT EXISTS "classifiedVendor" TEXT;
ALTER TABLE "LabReport" ADD COLUMN IF NOT EXISTS "parserUsed" TEXT;
ALTER TABLE "LabReport" ADD COLUMN IF NOT EXISTS "extractionTraceJson" JSONB;

ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "validationErrorsJson" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "LabAnalyteCatalog" ADD COLUMN IF NOT EXISTS "loincCode" TEXT;
ALTER TABLE "LabAnalyteCatalog" ADD COLUMN IF NOT EXISTS "allowedUnitsJson" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "LabReport_classifiedVendor_idx" ON "LabReport"("classifiedVendor");
