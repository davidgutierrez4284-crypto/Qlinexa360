-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('CONFIRMATION_48H', 'CONFIRMATION_24H', 'CONFIRMATION_12H', 'FINAL_REMINDER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'RESPONDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConfirmationResponse" AS ENUM ('CONFIRMED', 'CANCELLED', 'RESCHEDULE', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'ASSIGNED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "confirmationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "rescheduledFrom" TIMESTAMP(3),
ADD COLUMN     "rescheduledTo" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppointmentConfirmationRequest" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "reminderType" "ReminderType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "patientResponse" "ConfirmationResponse",
    "respondedAt" TIMESTAMP(3),
    "confirmationToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentConfirmationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "preferredDate" TIMESTAMP(3),
    "preferredTimeSlot" TEXT,
    "urgency" "UrgencyLevel" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentConfirmationRequest_confirmationToken_key" ON "AppointmentConfirmationRequest"("confirmationToken");

-- CreateIndex
CREATE INDEX "AppointmentConfirmationRequest_appointmentId_idx" ON "AppointmentConfirmationRequest"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentConfirmationRequest_scheduledFor_idx" ON "AppointmentConfirmationRequest"("scheduledFor");

-- CreateIndex
CREATE INDEX "AppointmentConfirmationRequest_status_idx" ON "AppointmentConfirmationRequest"("status");

-- CreateIndex
CREATE INDEX "AppointmentConfirmationRequest_confirmationToken_idx" ON "AppointmentConfirmationRequest"("confirmationToken");

-- CreateIndex
CREATE INDEX "WaitlistEntry_patientId_idx" ON "WaitlistEntry"("patientId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_doctorId_idx" ON "WaitlistEntry"("doctorId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_urgency_idx" ON "WaitlistEntry"("urgency");

-- CreateIndex
CREATE INDEX "WaitlistEntry_preferredDate_idx" ON "WaitlistEntry"("preferredDate");

-- CreateIndex
CREATE INDEX "Appointment_confirmationStatus_idx" ON "Appointment"("confirmationStatus");

-- CreateIndex
CREATE INDEX "Appointment_date_confirmationStatus_idx" ON "Appointment"("date", "confirmationStatus");

-- AddForeignKey
ALTER TABLE "AppointmentConfirmationRequest" ADD CONSTRAINT "AppointmentConfirmationRequest_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
