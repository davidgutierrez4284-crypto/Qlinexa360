/*
  Warnings:

  - You are about to drop the column `appointmentId` on the `Prescription` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Prescription` table. All the data in the column will be lost.
  - You are about to drop the column `doctorPatientId` on the `Prescription` table. All the data in the column will be lost.
  - Added the required column `fileId` to the `Prescription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `medicalRecordId` to the `Prescription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `PrescriptionTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_doctorPatientId_fkey";

-- DropIndex
DROP INDEX "Prescription_doctorId_idx";

-- DropIndex
DROP INDEX "Prescription_doctorPatientId_idx";

-- DropIndex
DROP INDEX "Prescription_patientId_idx";

-- AlterTable
ALTER TABLE "Prescription" DROP COLUMN "appointmentId",
DROP COLUMN "content",
DROP COLUMN "doctorPatientId",
ADD COLUMN     "fileId" TEXT NOT NULL,
ADD COLUMN     "medicalRecordId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PrescriptionTemplate" ADD COLUMN     "name" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
