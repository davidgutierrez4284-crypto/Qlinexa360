-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ASISTENTE';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "realizadoPor" TEXT,
ADD COLUMN     "vinculadoADoctor" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "realizadoPor" TEXT,
ADD COLUMN     "vinculadoADoctor" TEXT;

-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN     "realizadoPor" TEXT,
ADD COLUMN     "vinculadoADoctor" TEXT;

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "realizadoPor" TEXT,
ADD COLUMN     "vinculadoADoctor" TEXT;

-- AlterTable
ALTER TABLE "StudyDocument" ADD COLUMN     "realizadoPor" TEXT,
ADD COLUMN     "vinculadoADoctor" TEXT;

-- CreateTable
CREATE TABLE "AsistenteDoctorVinculo" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "asistenteId" TEXT NOT NULL,
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "permisosCitas" BOOLEAN NOT NULL DEFAULT false,
    "permisosHistorial" BOOLEAN NOT NULL DEFAULT false,
    "permisosRecetas" BOOLEAN NOT NULL DEFAULT false,
    "permisosNotas" BOOLEAN NOT NULL DEFAULT false,
    "permisosEstudios" BOOLEAN NOT NULL DEFAULT false,
    "permisosEvolucion" BOOLEAN NOT NULL DEFAULT false,
    "permisosFacturacion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AsistenteDoctorVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsistenteDoctorVinculo_doctorId_idx" ON "AsistenteDoctorVinculo"("doctorId");

-- CreateIndex
CREATE INDEX "AsistenteDoctorVinculo_asistenteId_idx" ON "AsistenteDoctorVinculo"("asistenteId");

-- CreateIndex
CREATE INDEX "AsistenteDoctorVinculo_activo_idx" ON "AsistenteDoctorVinculo"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenteDoctorVinculo_doctorId_asistenteId_key" ON "AsistenteDoctorVinculo"("doctorId", "asistenteId");

-- AddForeignKey
ALTER TABLE "AsistenteDoctorVinculo" ADD CONSTRAINT "AsistenteDoctorVinculo_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenteDoctorVinculo" ADD CONSTRAINT "AsistenteDoctorVinculo_asistenteId_fkey" FOREIGN KEY ("asistenteId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
