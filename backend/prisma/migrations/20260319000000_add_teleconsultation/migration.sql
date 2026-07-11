-- AlterTable: Añadir appointmentType a Appointment
ALTER TABLE "Appointment" ADD COLUMN "appointmentType" TEXT NOT NULL DEFAULT 'presencial';

-- CreateTable: Teleconsultation
CREATE TABLE "teleconsultations" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "videoProvider" TEXT NOT NULL DEFAULT 'google_meet',
    "externalEventId" TEXT,
    "meetingUrl" TEXT,
    "consentSigned" BOOLEAN NOT NULL DEFAULT false,
    "consentPdfUrl" TEXT,
    "consentDocumentHash" TEXT,
    "consentSignedAt" TIMESTAMP(3),
    "consentIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teleconsultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeleconsultationAuditLog
CREATE TABLE IF NOT EXISTS "teleconsultation_audit_logs" (
    "id" TEXT NOT NULL,
    "teleconsultationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teleconsultation_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teleconsultations_appointmentId_key" ON "teleconsultations"("appointmentId");
CREATE INDEX "teleconsultations_appointmentId_idx" ON "teleconsultations"("appointmentId");
CREATE INDEX "teleconsultation_audit_logs_teleconsultationId_idx" ON "teleconsultation_audit_logs"("teleconsultationId");

-- AddForeignKey
ALTER TABLE "teleconsultations" ADD CONSTRAINT "teleconsultations_appointmentId_fkey" 
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
