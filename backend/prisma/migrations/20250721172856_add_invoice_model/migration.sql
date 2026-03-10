/*
  Warnings:

  - You are about to drop the column `amount` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Invoice` table. All the data in the column will be lost.
  - Added the required column `invoiceDate` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientLastName` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientName` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientRFC` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pdfUrl` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `xmlUrl` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Made the column `doctorId` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `patientId` on table `Invoice` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_patientId_fkey";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "amount",
DROP COLUMN "paidAt",
DROP COLUMN "status",
ADD COLUMN     "invoiceDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "patientLastName" TEXT NOT NULL,
ADD COLUMN     "patientName" TEXT NOT NULL,
ADD COLUMN     "patientRFC" TEXT NOT NULL,
ADD COLUMN     "pdfUrl" TEXT NOT NULL,
ADD COLUMN     "xmlUrl" TEXT NOT NULL,
ALTER COLUMN "doctorId" SET NOT NULL,
ALTER COLUMN "patientId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Invoice_doctorId_idx" ON "Invoice"("doctorId");

-- CreateIndex
CREATE INDEX "Invoice_patientId_idx" ON "Invoice"("patientId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
