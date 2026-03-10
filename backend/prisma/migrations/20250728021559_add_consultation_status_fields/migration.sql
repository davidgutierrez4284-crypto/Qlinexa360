-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN     "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isComplete" BOOLEAN NOT NULL DEFAULT false;
