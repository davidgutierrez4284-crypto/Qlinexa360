-- AlterTable
ALTER TABLE "File" ADD COLUMN     "securityHash" TEXT,
ADD COLUMN     "securityValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "securityWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[];
