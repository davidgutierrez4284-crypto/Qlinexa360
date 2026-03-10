-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "insuranceCompany" TEXT,
ADD COLUMN     "insuranceEndDate" TIMESTAMP(3),
ADD COLUMN     "insurancePolicyHolder" TEXT,
ADD COLUMN     "insurancePolicyNumber" TEXT,
ADD COLUMN     "insuranceStartDate" TIMESTAMP(3);
