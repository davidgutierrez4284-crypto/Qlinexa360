-- Créditos de referido: 20% por colega acumulable; 100% = 1 mes gratis automático (contador de meses otorgados)
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "referralFreeMonthsGranted" INTEGER NOT NULL DEFAULT 0;
