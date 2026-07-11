-- Cobro opcional Mercado Pago en consultas presenciales
ALTER TABLE "doctor_mercadopago_settings"
ADD COLUMN IF NOT EXISTS "inPersonEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "inPersonDefaultAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "offerInPersonMercadoPago" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "inPersonPaymentAmount" DECIMAL(12,2);
