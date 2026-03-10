/*
  Warnings:

  - The values [PRESCRIPTION,LAB_STUDY_REQUEST,LAB_STUDY_RESULT,XRAY,OTHER] on the enum `FileCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `calendarType` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `calendarUrl` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ExternalCalendarLink` table. All the data in the column will be lost.
  - You are about to drop the column `isLocked` on the `MedicalRecord` table. All the data in the column will be lost.
  - You are about to drop the column `doctorId` on the `agenda_pacientes_links` table. All the data in the column will be lost.
  - You are about to drop the column `estaActivo` on the `agenda_pacientes_links` table. All the data in the column will be lost.
  - You are about to drop the column `fechaCreacion` on the `agenda_pacientes_links` table. All the data in the column will be lost.
  - You are about to drop the column `mensajeCustom` on the `agenda_pacientes_links` table. All the data in the column will be lost.
  - Added the required column `accessToken` to the `ExternalCalendarLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `calendarioId` to the `ExternalCalendarLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoConexion` to the `ExternalCalendarLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `doctor_id` to the `agenda_pacientes_links` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FileCategory_new" AS ENUM ('PRESCRIPTION_REQUEST', 'DOCTOR_PHOTO', 'STUDY_RESULT', 'PATIENT_PHOTO');
ALTER TABLE "File" ALTER COLUMN "category" TYPE "FileCategory_new" USING ("category"::text::"FileCategory_new");
ALTER TYPE "FileCategory" RENAME TO "FileCategory_old";
ALTER TYPE "FileCategory_new" RENAME TO "FileCategory";
DROP TYPE "FileCategory_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "agenda_pacientes_links" DROP CONSTRAINT "agenda_pacientes_links_doctorId_fkey";

-- DropIndex
DROP INDEX "agenda_pacientes_links_doctorId_idx";

-- AlterTable
ALTER TABLE "ExternalCalendarLink" DROP COLUMN "calendarType",
DROP COLUMN "calendarUrl",
DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "updatedAt",
ADD COLUMN     "accessToken" TEXT NOT NULL,
ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "calendarioId" TEXT NOT NULL,
ADD COLUMN     "fechaVinculacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tipoConexion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MedicalRecord" DROP COLUMN "isLocked";

-- AlterTable
ALTER TABLE "agenda_pacientes_links" DROP COLUMN "doctorId",
DROP COLUMN "estaActivo",
DROP COLUMN "fechaCreacion",
DROP COLUMN "mensajeCustom",
ADD COLUMN     "doctor_id" TEXT NOT NULL,
ADD COLUMN     "esta_activo" BOOLEAN DEFAULT false,
ADD COLUMN     "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "mensaje_custom" TEXT,
ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;

-- CreateTable
CREATE TABLE "patient_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "patient_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "assistant_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_invitations_token_key" ON "patient_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_invitations_token_key" ON "assistant_invitations"("token");

-- CreateIndex
CREATE INDEX "ExternalCalendarLink_activo_idx" ON "ExternalCalendarLink"("activo");

-- CreateIndex
CREATE INDEX "ExternalCalendarLink_tipoConexion_idx" ON "ExternalCalendarLink"("tipoConexion");

-- CreateIndex
CREATE INDEX "idx_agenda_pacientes_links_doctor_id" ON "agenda_pacientes_links"("doctor_id");

-- AddForeignKey
ALTER TABLE "agenda_pacientes_links" ADD CONSTRAINT "fk_doctor" FOREIGN KEY ("doctor_id") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_invitations" ADD CONSTRAINT "patient_invitations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_invitations" ADD CONSTRAINT "assistant_invitations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
