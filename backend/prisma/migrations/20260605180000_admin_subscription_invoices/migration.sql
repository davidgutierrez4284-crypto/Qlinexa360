-- Datos fiscales adicionales del doctor (receptor de la factura de suscripción)
ALTER TABLE "Doctor" ADD COLUMN     "taxPostalCode" TEXT,
ADD COLUMN     "taxRegime" TEXT;

-- Facturas de la suscripción que Qlinexa (admin) emite a cada doctor
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doctorId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "pdfUrl" TEXT,
    "xmlUrl" TEXT,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdByAdminUserId" TEXT,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionInvoice_doctorId_idx" ON "SubscriptionInvoice"("doctorId");
CREATE INDEX "SubscriptionInvoice_invoiceDate_idx" ON "SubscriptionInvoice"("invoiceDate");

ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
