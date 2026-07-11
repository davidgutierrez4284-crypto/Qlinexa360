-- AlterTable: Añadir taxPostalCode y taxRegime a Patient (opcionales, solo aplican para México)
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "taxPostalCode" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "taxRegime" TEXT;
