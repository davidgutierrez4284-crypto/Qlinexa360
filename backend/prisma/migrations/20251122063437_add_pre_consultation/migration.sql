-- CreateEnum
CREATE TYPE "PreConsultationStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "pre_consultations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "formData" JSONB,
    "status" "PreConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "pre_consultations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pre_consultations_token_key" ON "pre_consultations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "pre_consultations_appointmentId_key" ON "pre_consultations"("appointmentId");

-- CreateIndex
CREATE INDEX "pre_consultations_appointmentId_idx" ON "pre_consultations"("appointmentId");

-- CreateIndex
CREATE INDEX "pre_consultations_patientId_idx" ON "pre_consultations"("patientId");

-- CreateIndex
CREATE INDEX "pre_consultations_doctorId_idx" ON "pre_consultations"("doctorId");

-- CreateIndex
CREATE INDEX "pre_consultations_token_idx" ON "pre_consultations"("token");

-- CreateIndex
CREATE INDEX "pre_consultations_status_idx" ON "pre_consultations"("status");

-- AddForeignKey
ALTER TABLE "pre_consultations" ADD CONSTRAINT "pre_consultations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_consultations" ADD CONSTRAINT "pre_consultations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_consultations" ADD CONSTRAINT "pre_consultations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
