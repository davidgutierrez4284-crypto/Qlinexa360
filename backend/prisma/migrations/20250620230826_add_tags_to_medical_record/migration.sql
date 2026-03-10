-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
