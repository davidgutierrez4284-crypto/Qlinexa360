-- Monto de cobro Mercado Pago por teleconsulta (definido al crear/editar la cita)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "teleconsultationAmount" DECIMAL(12, 2);
