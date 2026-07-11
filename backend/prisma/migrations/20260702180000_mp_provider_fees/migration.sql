-- Comisión de procesamiento Mercado Pago y neto acreditado al vendedor

ALTER TABLE "payments"
ADD COLUMN "providerProcessingFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "netReceivedAmount" DECIMAL(12,2);
