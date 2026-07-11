-- AlterTable
ALTER TABLE "payments" ADD COLUMN "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "MercadoPagoRefundRequestStatus" AS ENUM ('pending', 'rejected', 'completed', 'failed');

-- CreateTable
CREATE TABLE "mercadopago_refund_requests" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "doctorNotes" TEXT,
    "status" "MercadoPagoRefundRequestStatus" NOT NULL DEFAULT 'pending',
    "providerRefundId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadopago_refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mercadopago_refund_requests_doctorId_status_idx" ON "mercadopago_refund_requests"("doctorId", "status");

-- CreateIndex
CREATE INDEX "mercadopago_refund_requests_paymentId_idx" ON "mercadopago_refund_requests"("paymentId");

-- CreateIndex
CREATE INDEX "mercadopago_refund_requests_appointmentId_idx" ON "mercadopago_refund_requests"("appointmentId");

-- AddForeignKey
ALTER TABLE "mercadopago_refund_requests" ADD CONSTRAINT "mercadopago_refund_requests_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_refund_requests" ADD CONSTRAINT "mercadopago_refund_requests_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_refund_requests" ADD CONSTRAINT "mercadopago_refund_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_refund_requests" ADD CONSTRAINT "mercadopago_refund_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
