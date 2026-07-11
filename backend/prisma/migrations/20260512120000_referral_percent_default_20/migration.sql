-- Default de percentGranted alineado con PERCENT_PER_REFERRAL = 20 (filas existentes no se modifican).
ALTER TABLE "referral_conversions" ALTER COLUMN "percentGranted" SET DEFAULT 20;
