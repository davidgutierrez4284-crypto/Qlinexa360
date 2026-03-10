/*
  Warnings:

  - Added the required column `autorConsultaId` to the `MedicalRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Primero agregamos la columna como nullable
ALTER TABLE "MedicalRecord" ADD COLUMN "autorConsultaId" TEXT,
ADD COLUMN "isEditable" BOOLEAN NOT NULL DEFAULT true;

-- Actualizamos los registros existentes usando userId como autorConsultaId
UPDATE "MedicalRecord" SET "autorConsultaId" = "userId" WHERE "autorConsultaId" IS NULL;

-- Ahora hacemos la columna NOT NULL
ALTER TABLE "MedicalRecord" ALTER COLUMN "autorConsultaId" SET NOT NULL;

-- CreateTable
CREATE TABLE "PadecimientoDoctorColaborador" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "padecimientoId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PadecimientoDoctorColaborador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PadecimientoDoctorColaborador_patientId_idx" ON "PadecimientoDoctorColaborador"("patientId");

-- CreateIndex
CREATE INDEX "PadecimientoDoctorColaborador_padecimientoId_idx" ON "PadecimientoDoctorColaborador"("padecimientoId");

-- CreateIndex
CREATE INDEX "PadecimientoDoctorColaborador_doctorId_idx" ON "PadecimientoDoctorColaborador"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "PadecimientoDoctorColaborador_patientId_padecimientoId_doct_key" ON "PadecimientoDoctorColaborador"("patientId", "padecimientoId", "doctorId");

-- CreateIndex
CREATE INDEX "MedicalRecord_autorConsultaId_idx" ON "MedicalRecord"("autorConsultaId");

-- AddForeignKey
ALTER TABLE "PadecimientoDoctorColaborador" ADD CONSTRAINT "PadecimientoDoctorColaborador_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadecimientoDoctorColaborador" ADD CONSTRAINT "PadecimientoDoctorColaborador_padecimientoId_fkey" FOREIGN KEY ("padecimientoId") REFERENCES "ClinicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadecimientoDoctorColaborador" ADD CONSTRAINT "PadecimientoDoctorColaborador_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
