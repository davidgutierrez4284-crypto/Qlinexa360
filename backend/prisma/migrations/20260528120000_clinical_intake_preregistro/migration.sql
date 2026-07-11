-- Pre-registro clínico (ClinicalIntake) + portal fijo por profesional

CREATE TYPE "ClinicalIntakeStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED_PENDING_VALIDATION',
  'APPROVED',
  'REJECTED',
  'CONVERTED'
);

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "intakePortalToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Doctor_intakePortalToken_key" ON "Doctor"("intakePortalToken");

CREATE TABLE IF NOT EXISTS "clinical_intakes" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT,
  "appointmentId" TEXT,
  "status" "ClinicalIntakeStatus" NOT NULL DEFAULT 'DRAFT',
  "formData" JSONB,
  "consultationReason" TEXT,
  "consentPrivacy" BOOLEAN NOT NULL DEFAULT false,
  "consentTreatment" BOOLEAN NOT NULL DEFAULT false,
  "consentPlatform" BOOLEAN NOT NULL DEFAULT false,
  "consentSignerName" TEXT,
  "consentSignedAt" TIMESTAMP(3),
  "consentIp" TEXT,
  "consentFileId" TEXT,
  "consentPdfUrl" TEXT,
  "consentDocumentHash" TEXT,
  "staffNotes" TEXT,
  "expiresAt" TIMESTAMP(3),
  "linkNeverExpires" BOOLEAN NOT NULL DEFAULT false,
  "convertedClinicalCaseId" TEXT,
  "convertedMedicalRecordId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "clinical_intakes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinical_intakes_token_key" ON "clinical_intakes"("token");
CREATE INDEX IF NOT EXISTS "clinical_intakes_doctorId_idx" ON "clinical_intakes"("doctorId");
CREATE INDEX IF NOT EXISTS "clinical_intakes_patientId_idx" ON "clinical_intakes"("patientId");
CREATE INDEX IF NOT EXISTS "clinical_intakes_appointmentId_idx" ON "clinical_intakes"("appointmentId");
CREATE INDEX IF NOT EXISTS "clinical_intakes_status_idx" ON "clinical_intakes"("status");

ALTER TABLE "clinical_intakes"
  ADD CONSTRAINT "clinical_intakes_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinical_intakes"
  ADD CONSTRAINT "clinical_intakes_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clinical_intakes"
  ADD CONSTRAINT "clinical_intakes_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
