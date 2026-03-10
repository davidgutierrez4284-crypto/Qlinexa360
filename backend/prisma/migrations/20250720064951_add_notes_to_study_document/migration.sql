/*
  Warnings:

  - You are about to drop the column `doctorPatientId` on the `StudyDocument` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StudyDocument" DROP CONSTRAINT "StudyDocument_doctorPatientId_fkey";

-- DropIndex
DROP INDEX "StudyDocument_doctorPatientId_idx";

-- AlterTable
ALTER TABLE "StudyDocument" DROP COLUMN "doctorPatientId",
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "title" SET DATA TYPE VARCHAR(50);
