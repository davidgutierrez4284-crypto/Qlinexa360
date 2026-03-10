/*
  Warnings:

  - The values [STUDY_RESULT] on the enum `FileCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `accessToken` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `activo` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `calendarioId` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `fechaVinculacion` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `tipoConexion` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - Added the required column `calendarType` to the `ExternalCalendarLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `calendarUrl` to the `ExternalCalendarLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ExternalCalendarLink` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FileCategory_new" AS ENUM ('PRESCRIPTION_REQUEST', 'DOCTOR_PHOTO', 'PATIENT_PHOTO', 'PRESCRIPTION', 'LAB_STUDY_REQUEST', 'LAB_STUDY_RESULT', 'XRAY', 'OTHER');
ALTER TABLE "File" ALTER COLUMN "category" TYPE "FileCategory_new" USING ("category"::text::"FileCategory_new");
ALTER TYPE "FileCategory" RENAME TO "FileCategory_old";
ALTER TYPE "FileCategory_new" RENAME TO "FileCategory";
DROP TYPE "FileCategory_old";
COMMIT;

-- DropIndex
DROP INDEX "ExternalCalendarLink_activo_idx";

-- DropIndex
DROP INDEX "ExternalCalendarLink_tipoConexion_idx";

-- AlterTable
ALTER TABLE "ExternalCalendarLink" DROP COLUMN "accessToken",
DROP COLUMN "activo",
DROP COLUMN "calendarioId",
DROP COLUMN "fechaVinculacion",
DROP COLUMN "refreshToken",
DROP COLUMN "tipoConexion",
ADD COLUMN     "calendarType" TEXT NOT NULL,
ADD COLUMN     "calendarUrl" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "agenda_pacientes_links" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "estaActivo" BOOLEAN NOT NULL DEFAULT false,
    "mensajeCustom" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_pacientes_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agenda_pacientes_links_link_key" ON "agenda_pacientes_links"("link");

-- CreateIndex
CREATE INDEX "agenda_pacientes_links_doctorId_idx" ON "agenda_pacientes_links"("doctorId");

-- AddForeignKey
ALTER TABLE "agenda_pacientes_links" ADD CONSTRAINT "agenda_pacientes_links_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
