-- Mercado Pago Marketplace payments module

CREATE TYPE "PaymentProvider" AS ENUM ('mercadopago');
CREATE TYPE "PaymentProviderConnectionStatus" AS ENUM ('active', 'pending', 'disconnected', 'error');
CREATE TYPE "MercadoPagoPaymentStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back');
CREATE TYPE "MercadoPagoPaymentType" AS ENUM ('teleconsultation', 'in_person', 'other');

CREATE TABLE "payment_provider_connections" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "doctorId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'mercadopago',
    "providerUserId" TEXT,
    "accountEmail" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "publicKey" TEXT,
    "status" "PaymentProviderConnectionStatus" NOT NULL DEFAULT 'pending',
    "lastConnectionAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "appointmentId" TEXT,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "platformCommissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platformCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "MercadoPagoPaymentStatus" NOT NULL DEFAULT 'pending',
    "paymentType" "MercadoPagoPaymentType" NOT NULL,
    "externalReference" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerPreferenceId" TEXT,
    "checkoutUrl" TEXT,
    "concept" TEXT,
    "metadataJson" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercadopago',
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctor_mercadopago_settings" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mandatoryBeforeVirtualLink" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "refundPolicyText" TEXT,
    "autoCancelOnPaymentRejected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_mercadopago_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_mercadopago_commission_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "commissionPercentage" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "commissionFixedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minCommissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxCommissionAmount" DECIMAL(12,2),
    "applyCommissionToTeleconsultation" BOOLEAN NOT NULL DEFAULT true,
    "applyCommissionToInPersonConsultation" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_mercadopago_commission_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_connections_doctorId_provider_key" ON "payment_provider_connections"("doctorId", "provider");
CREATE INDEX "payment_provider_connections_doctorId_idx" ON "payment_provider_connections"("doctorId");

CREATE UNIQUE INDEX "payments_externalReference_key" ON "payments"("externalReference");
CREATE INDEX "payments_appointmentId_idx" ON "payments"("appointmentId");
CREATE INDEX "payments_doctorId_idx" ON "payments"("doctorId");
CREATE INDEX "payments_patientId_idx" ON "payments"("patientId");
CREATE INDEX "payments_providerPaymentId_idx" ON "payments"("providerPaymentId");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_paymentType_idx" ON "payments"("paymentType");

CREATE INDEX "payment_audit_logs_paymentId_idx" ON "payment_audit_logs"("paymentId");
CREATE INDEX "payment_audit_logs_eventType_idx" ON "payment_audit_logs"("eventType");

CREATE UNIQUE INDEX "payment_webhook_events_providerEventId_key" ON "payment_webhook_events"("providerEventId");
CREATE INDEX "payment_webhook_events_eventType_idx" ON "payment_webhook_events"("eventType");

CREATE UNIQUE INDEX "doctor_mercadopago_settings_doctorId_key" ON "doctor_mercadopago_settings"("doctorId");

ALTER TABLE "payment_provider_connections" ADD CONSTRAINT "payment_provider_connections_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_audit_logs" ADD CONSTRAINT "payment_audit_logs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_mercadopago_settings" ADD CONSTRAINT "doctor_mercadopago_settings_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "platform_mercadopago_commission_rules" (
    "id", "name", "commissionPercentage", "commissionFixedAmount", "minCommissionAmount",
    "applyCommissionToTeleconsultation", "applyCommissionToInPersonConsultation", "isActive", "updatedAt"
) VALUES (
    gen_random_uuid()::text, 'Default MVP', 1, 0, 0, true, true, true, CURRENT_TIMESTAMP
);
