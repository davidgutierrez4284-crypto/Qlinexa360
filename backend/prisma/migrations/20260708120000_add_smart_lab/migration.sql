-- CreateEnum
CREATE TYPE "LabReportStatus" AS ENUM ('uploaded', 'processing', 'extraction_failed', 'pending_review', 'confirmed', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "LabAbnormalFlag" AS ENUM ('low', 'high', 'normal', 'critical_low', 'critical_high', 'unknown');

-- CreateEnum
CREATE TYPE "LabAlertType" AS ENUM ('out_of_range', 'trend_up', 'trend_down', 'critical', 'missing_followup', 'significant_change');

-- CreateEnum
CREATE TYPE "LabSeverity" AS ENUM ('green', 'yellow', 'red', 'gray');

-- CreateEnum
CREATE TYPE "LabAuditAction" AS ENUM ('upload', 'extract', 'extract_failed', 'review', 'manual_correction', 'confirm', 'reject', 'view', 'download', 'archive', 'delete');

-- CreateTable
CREATE TABLE "LabReport" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "clinicId" TEXT,
    "laboratoryName" TEXT,
    "studyType" TEXT,
    "studyDate" TIMESTAMP(3),
    "reportDate" TIMESTAMP(3),
    "sourcePdfUrl" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "extractionStatus" "LabReportStatus" NOT NULL DEFAULT 'uploaded',
    "extractionEngine" TEXT,
    "extractionConfidence" DOUBLE PRECISION,
    "rawText" TEXT,
    "reviewedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "labReportId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "analyteCatalogId" TEXT,
    "analyteNameRaw" TEXT NOT NULL,
    "analyteNameNormalized" TEXT,
    "resultValue" DOUBLE PRECISION,
    "resultValueText" TEXT,
    "resultUnit" TEXT,
    "referenceRangeLow" DOUBLE PRECISION,
    "referenceRangeHigh" DOUBLE PRECISION,
    "referenceRangeText" TEXT,
    "abnormalFlag" "LabAbnormalFlag" NOT NULL DEFAULT 'unknown',
    "extractionConfidence" DOUBLE PRECISION,
    "rawTextSnippet" TEXT,
    "manuallyCorrected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabAnalyteCatalog" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliasesJson" JSONB NOT NULL DEFAULT '[]',
    "defaultUnit" TEXT,
    "defaultReferenceLow" DOUBLE PRECISION,
    "defaultReferenceHigh" DOUBLE PRECISION,
    "referenceNotes" TEXT,
    "sexSpecific" BOOLEAN NOT NULL DEFAULT false,
    "ageSpecific" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabAnalyteCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabAlert" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "labResultId" TEXT,
    "analyteCatalogId" TEXT,
    "alertType" "LabAlertType" NOT NULL,
    "severity" "LabSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    "dismissedByUserId" TEXT,

    CONSTRAINT "LabAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabHealthDashboardScore" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "LabSeverity" NOT NULL,
    "score" DOUBLE PRECISION,
    "summary" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabHealthDashboardScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "patientId" TEXT,
    "labReportId" TEXT,
    "action" "LabAuditAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabReport_patientId_studyDate_idx" ON "LabReport"("patientId", "studyDate");

-- CreateIndex
CREATE INDEX "LabReport_doctorId_idx" ON "LabReport"("doctorId");

-- CreateIndex
CREATE INDEX "LabResult_labReportId_idx" ON "LabResult"("labReportId");

-- CreateIndex
CREATE INDEX "LabResult_patientId_analyteCatalogId_idx" ON "LabResult"("patientId", "analyteCatalogId");

-- CreateIndex
CREATE INDEX "LabAnalyteCatalog_category_idx" ON "LabAnalyteCatalog"("category");

-- CreateIndex
CREATE INDEX "LabAnalyteCatalog_name_idx" ON "LabAnalyteCatalog"("name");

-- CreateIndex
CREATE INDEX "LabAlert_patientId_idx" ON "LabAlert"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "LabHealthDashboardScore_patientId_category_key" ON "LabHealthDashboardScore"("patientId", "category");

-- CreateIndex
CREATE INDEX "LabAuditLog_patientId_idx" ON "LabAuditLog"("patientId");

-- CreateIndex
CREATE INDEX "LabAuditLog_labReportId_idx" ON "LabAuditLog"("labReportId");

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_labReportId_fkey" FOREIGN KEY ("labReportId") REFERENCES "LabReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_analyteCatalogId_fkey" FOREIGN KEY ("analyteCatalogId") REFERENCES "LabAnalyteCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAlert" ADD CONSTRAINT "LabAlert_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAlert" ADD CONSTRAINT "LabAlert_labResultId_fkey" FOREIGN KEY ("labResultId") REFERENCES "LabResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAlert" ADD CONSTRAINT "LabAlert_analyteCatalogId_fkey" FOREIGN KEY ("analyteCatalogId") REFERENCES "LabAnalyteCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAlert" ADD CONSTRAINT "LabAlert_dismissedByUserId_fkey" FOREIGN KEY ("dismissedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabHealthDashboardScore" ADD CONSTRAINT "LabHealthDashboardScore_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAuditLog" ADD CONSTRAINT "LabAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
